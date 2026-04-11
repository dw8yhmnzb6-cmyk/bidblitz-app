"""
BidBlitz V2 - Car Rental Schemas
Pydantic schemas for request/response validation.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, validator
from .models import (
    VendorStatus, CarStatus, FuelType, GearboxType, BookingStatus,
    PaymentStatus, InvoiceStatus, DamageSeverity, StaffRole,
    VendorCompanyInfo, VendorSettings, CarExtra, CarLocation, CarInsurance,
    HandoverRecord, InvoiceLineItem
)


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class VendorRegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=200)
    legal_name: Optional[str] = None
    tax_id: Optional[str] = None
    vat_id: Optional[str] = None
    address: str
    city: str
    postal_code: str
    country: str = "DE"
    phone: str
    email: str
    website: Optional[str] = None
    description: Optional[str] = None


class VendorUpdateRequest(BaseModel):
    company_name: Optional[str] = None
    legal_name: Optional[str] = None
    tax_id: Optional[str] = None
    vat_id: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    bank_name: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None


class VendorSettingsUpdate(BaseModel):
    auto_approve_bookings: Optional[bool] = None
    min_booking_hours: Optional[int] = None
    max_booking_days: Optional[int] = None
    cancellation_hours: Optional[int] = None
    cancellation_fee_percent: Optional[float] = None
    late_return_fee_per_hour: Optional[float] = None
    cleaning_fee: Optional[float] = None
    fuel_fee_per_liter: Optional[float] = None
    require_deposit: Optional[bool] = None
    require_documents: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════════════════
# CAR SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class CarCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    brand: str
    model: str
    year: int = Field(..., ge=1990, le=2030)
    registration_number: str
    vin: Optional[str] = None
    color: str
    fuel_type: FuelType
    gearbox: GearboxType
    seats: int = Field(default=5, ge=1, le=50)
    doors: int = Field(default=4, ge=2, le=6)
    mileage: int = Field(default=0, ge=0)
    
    # Location
    city: str
    address: Optional[str] = None
    postal_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    
    # Pricing
    price_per_day: float = Field(..., gt=0)
    price_per_week: Optional[float] = None
    price_per_month: Optional[float] = None
    deposit_amount: float = Field(default=500, ge=0)
    deductible: float = Field(default=1000, ge=0)
    
    # Requirements
    min_driver_age: int = Field(default=21, ge=18)
    min_license_years: int = Field(default=1, ge=0)
    
    # Description & Features
    description: Optional[str] = None
    features: List[str] = []
    
    # Insurance
    insurance_provider: Optional[str] = None
    insurance_policy: Optional[str] = None
    insurance_deductible: Optional[float] = None
    insurance_expires: Optional[str] = None
    
    # Service
    inspection_date: Optional[str] = None
    next_service_date: Optional[str] = None
    service_interval_km: Optional[int] = None


class CarUpdateRequest(BaseModel):
    title: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    fuel_type: Optional[FuelType] = None
    gearbox: Optional[GearboxType] = None
    seats: Optional[int] = None
    doors: Optional[int] = None
    mileage: Optional[int] = None
    
    city: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    
    price_per_day: Optional[float] = None
    price_per_week: Optional[float] = None
    price_per_month: Optional[float] = None
    deposit_amount: Optional[float] = None
    deductible: Optional[float] = None
    
    min_driver_age: Optional[int] = None
    min_license_years: Optional[int] = None
    
    description: Optional[str] = None
    features: Optional[List[str]] = None
    status: Optional[CarStatus] = None
    
    insurance_provider: Optional[str] = None
    insurance_policy: Optional[str] = None
    insurance_deductible: Optional[float] = None
    insurance_expires: Optional[str] = None
    
    inspection_date: Optional[str] = None
    next_service_date: Optional[str] = None
    service_interval_km: Optional[int] = None


class CarExtraCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_per_day: float = Field(..., gt=0)
    price_per_rental: Optional[float] = None


class CarSearchParams(BaseModel):
    city: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    fuel_type: Optional[FuelType] = None
    gearbox: Optional[GearboxType] = None
    min_seats: Optional[int] = None
    brand: Optional[str] = None
    sort_by: Optional[str] = "price"  # price, newest, popular
    page: int = 1
    limit: int = 20


# ══════════════════════════════════════════════════════════════════════════════
# BOOKING SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class BookingCreateRequest(BaseModel):
    car_id: str
    start_date: str  # ISO format
    end_date: str  # ISO format
    pickup_time: str = "10:00"
    return_time: str = "10:00"
    extras: List[str] = []  # List of extra_ids
    notes: Optional[str] = None
    promo_code: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
    reason: Optional[str] = None
    notes: Optional[str] = None


class BookingExtraCharge(BaseModel):
    description: str
    amount: float
    charge_type: str  # late_return, fuel, damage, cleaning, other


class HandoverRequest(BaseModel):
    mileage: int
    fuel_level: int = Field(..., ge=0, le=100)
    photos: List[str] = []
    existing_damages: List[str] = []
    accessories: Dict[str, bool] = {}
    notes: Optional[str] = None
    signature_customer: Optional[str] = None


class ReturnRequest(BaseModel):
    mileage: int
    fuel_level: int = Field(..., ge=0, le=100)
    photos: List[str] = []
    new_damages: List[str] = []
    notes: Optional[str] = None
    signature_customer: Optional[str] = None
    late_return_hours: Optional[float] = None
    cleaning_needed: bool = False
    fuel_difference: Optional[int] = None


# ══════════════════════════════════════════════════════════════════════════════
# INVOICE SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class InvoiceGenerateRequest(BaseModel):
    booking_id: str
    include_deposit: bool = True
    extra_charges: List[BookingExtraCharge] = []
    discount_amount: Optional[float] = None
    discount_reason: Optional[str] = None
    notes: Optional[str] = None


class InvoiceUpdateRequest(BaseModel):
    status: Optional[InvoiceStatus] = None
    paid_amount: Optional[float] = None
    paid_at: Optional[str] = None
    notes: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# CONTRACT SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ContractGenerateRequest(BaseModel):
    booking_id: str
    template_id: Optional[str] = None
    additional_terms: Optional[str] = None


class ContractTemplateCreate(BaseModel):
    name: str
    content: str  # HTML/Markdown with placeholders
    is_default: bool = False


# ══════════════════════════════════════════════════════════════════════════════
# DAMAGE REPORT SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class DamageReportCreate(BaseModel):
    booking_id: str
    car_id: str
    description: str
    severity: DamageSeverity
    location_on_vehicle: str
    photos: List[str] = []
    estimated_cost: Optional[float] = None
    notes: Optional[str] = None


class DamageReportUpdate(BaseModel):
    description: Optional[str] = None
    severity: Optional[DamageSeverity] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    resolved: Optional[bool] = None
    resolution_notes: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# STAFF SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class StaffCreateRequest(BaseModel):
    email: str
    name: str
    role: StaffRole = StaffRole.EMPLOYEE
    permissions: List[str] = []


class StaffUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[StaffRole] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class AdminVendorAction(BaseModel):
    action: str  # approve, suspend, reject
    reason: Optional[str] = None


class AdminCommissionUpdate(BaseModel):
    vendor_id: Optional[str] = None  # None = global default
    commission_percent: float = Field(..., ge=0, le=100)


class AdminSettingsUpdate(BaseModel):
    default_commission: Optional[float] = None
    min_payout_amount: Optional[float] = None
    payout_schedule: Optional[str] = None  # daily, weekly, monthly
    require_vendor_verification: Optional[bool] = None
    max_booking_days: Optional[int] = None


# ══════════════════════════════════════════════════════════════════════════════
# PAYOUT SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class PayoutRequest(BaseModel):
    amount: float = Field(..., gt=0)
    bank_reference: Optional[str] = None


class PayoutStatusUpdate(BaseModel):
    status: str  # processing, completed, failed
    transaction_ref: Optional[str] = None
    notes: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER DOCUMENT SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class CustomerDocumentUpload(BaseModel):
    doc_type: str  # license, id_card, passport
    file_url: str
    expires_at: Optional[str] = None
