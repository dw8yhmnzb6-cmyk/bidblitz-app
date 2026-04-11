"""
BidBlitz V2 - Car Rental Routes
FastAPI endpoints for car rental module.
"""

from fastapi import APIRouter, HTTPException, Request, Query, UploadFile, File
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime, timezone
import logging
import secrets

from core.security import get_current_user
from core.database import db, sanitize_doc

from .models import VendorStatus, CarStatus, BookingStatus, FuelType, GearboxType, StaffRole
from .schemas import (
    VendorRegisterRequest, VendorUpdateRequest, VendorSettingsUpdate,
    CarCreateRequest, CarUpdateRequest, CarExtraCreate, CarSearchParams,
    BookingCreateRequest, BookingStatusUpdate, BookingExtraCharge,
    HandoverRequest, ReturnRequest,
    InvoiceGenerateRequest, InvoiceUpdateRequest,
    ContractGenerateRequest, ContractTemplateCreate,
    DamageReportCreate, DamageReportUpdate,
    StaffCreateRequest, StaffUpdateRequest,
    AdminVendorAction, AdminCommissionUpdate, AdminSettingsUpdate,
    PayoutRequest, PayoutStatusUpdate,
    CustomerDocumentUpload
)
from .repository import (
    VendorRepository, CarRepository, BookingRepository, InvoiceRepository,
    ContractRepository, DamageRepository, StaffRepository, PayoutRepository,
    CustomerDocumentRepository, ActivityLogRepository
)
from .services import (
    VendorService, CarService, BookingService, InvoiceService,
    ContractService, PayoutService
)

router = APIRouter(prefix="/api/car-rental", tags=["car-rental"])
logger = logging.getLogger("bidblitz.car_rental")


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

async def require_vendor_access(request: Request, vendor_id: str = None):
    """Verify user has vendor access."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if vendor_id:
        can_access, role = await VendorService.can_access_vendor(user_id, vendor_id)
        if not can_access:
            raise HTTPException(status_code=403, detail="Keine Berechtigung")
        return user, vendor_id, role
    else:
        # Get user's vendor
        vendor = await VendorRepository.get_by_user_id(user_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Kein Vermieter-Konto gefunden")
        return user, vendor["vendor_id"], "owner"


async def require_admin(request: Request):
    """Verify user is admin."""
    user = await get_current_user(request)
    if user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin-Rechte erforderlich")
    return user


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC ROUTES - CAR BROWSING
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/cars/search")
async def search_cars(
    city: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    fuel_type: Optional[FuelType] = None,
    gearbox: Optional[GearboxType] = None,
    min_seats: Optional[int] = None,
    brand: Optional[str] = None,
    sort_by: Optional[str] = "price",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50)
):
    """Search available cars (public)."""
    params = {
        "city": city,
        "start_date": start_date,
        "end_date": end_date,
        "min_price": min_price,
        "max_price": max_price,
        "fuel_type": fuel_type.value if fuel_type else None,
        "gearbox": gearbox.value if gearbox else None,
        "min_seats": min_seats,
        "brand": brand,
        "sort_by": sort_by,
        "page": page,
        "limit": limit,
    }
    
    cars, total = await CarRepository.search_public(params)
    
    return {
        "cars": cars,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/cars/{car_id}")
async def get_car_detail(car_id: str):
    """Get car details (public)."""
    car = await CarService.get_car_detail_public(car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    return car


@router.get("/cars/{car_id}/price")
async def calculate_car_price(
    car_id: str,
    start_date: str,
    end_date: str,
    extras: Optional[str] = None
):
    """Calculate rental price (public)."""
    extras_list = extras.split(",") if extras else []
    pricing = await CarService.calculate_rental_price(car_id, start_date, end_date, extras_list)
    if not pricing:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    return pricing


@router.get("/cars/{car_id}/availability")
async def check_car_availability(car_id: str, start_date: str, end_date: str):
    """Check car availability for date range."""
    is_available = await BookingRepository.check_availability(car_id, start_date, end_date)
    return {"available": is_available}


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR REGISTRATION & PROFILE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/vendor/register")
async def register_vendor(req: VendorRegisterRequest, request: Request):
    """Register as car rental vendor."""
    user = await get_current_user(request)
    
    vendor, error = await VendorService.register_vendor(str(user["_id"]), req.dict())
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True, "vendor": vendor}


@router.get("/vendor/profile")
async def get_vendor_profile(request: Request):
    """Get current vendor profile."""
    user, vendor_id, role = await require_vendor_access(request)
    vendor = await VendorRepository.get_by_id(vendor_id)
    return {"vendor": vendor, "role": role}


@router.put("/vendor/profile")
async def update_vendor_profile(req: VendorUpdateRequest, request: Request):
    """Update vendor profile."""
    user, vendor_id, role = await require_vendor_access(request)
    
    if role not in ["owner", "manager"]:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if update_data:
        # Update company info
        vendor = await VendorRepository.get_by_id(vendor_id)
        company = vendor.get("company", {})
        company.update(update_data)
        await VendorRepository.update(vendor_id, {"company": company})
    
    return {"ok": True}


@router.put("/vendor/settings")
async def update_vendor_settings(req: VendorSettingsUpdate, request: Request):
    """Update vendor settings."""
    user, vendor_id, role = await require_vendor_access(request)
    
    if role not in ["owner", "manager"]:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if update_data:
        vendor = await VendorRepository.get_by_id(vendor_id)
        settings = vendor.get("settings", {})
        settings.update(update_data)
        await VendorRepository.update(vendor_id, {"settings": settings})
    
    return {"ok": True}


@router.get("/vendor/dashboard")
async def get_vendor_dashboard(request: Request):
    """Get vendor dashboard summary."""
    user, vendor_id, role = await require_vendor_access(request)
    
    dashboard = await VendorService.get_vendor_dashboard(vendor_id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard nicht gefunden")
    
    return dashboard


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR - CAR MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/vendor/cars")
async def create_car(req: CarCreateRequest, request: Request):
    """Create new car listing."""
    user, vendor_id, role = await require_vendor_access(request)
    
    car, error = await CarService.create_car(vendor_id, req.dict())
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True, "car": car}


@router.get("/vendor/cars")
async def list_vendor_cars(
    request: Request,
    status: Optional[CarStatus] = None,
    limit: int = Query(100, ge=1, le=500)
):
    """List vendor's cars."""
    user, vendor_id, role = await require_vendor_access(request)
    
    status_val = status.value if status else None
    cars = await CarRepository.list_by_vendor(vendor_id, status=status_val, limit=limit)
    
    return {"cars": cars}


@router.get("/vendor/cars/{car_id}")
async def get_vendor_car(car_id: str, request: Request):
    """Get vendor's car details."""
    user, vendor_id, role = await require_vendor_access(request)
    
    car = await CarRepository.get_by_id(car_id)
    if not car or car["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    
    return {"car": car}


@router.put("/vendor/cars/{car_id}")
async def update_car(car_id: str, req: CarUpdateRequest, request: Request):
    """Update car details."""
    user, vendor_id, role = await require_vendor_access(request)
    
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if req.status:
        update_data["status"] = req.status.value
    if req.fuel_type:
        update_data["fuel_type"] = req.fuel_type.value
    if req.gearbox:
        update_data["gearbox"] = req.gearbox.value
    
    car, error = await CarService.update_car(car_id, vendor_id, update_data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True, "car": car}


@router.delete("/vendor/cars/{car_id}")
async def archive_car(car_id: str, request: Request):
    """Archive a car."""
    user, vendor_id, role = await require_vendor_access(request)
    
    success, error = await CarService.archive_car(car_id, vendor_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.post("/vendor/cars/{car_id}/images")
async def add_car_image(car_id: str, request: Request):
    """Add image to car."""
    user, vendor_id, role = await require_vendor_access(request)
    
    car = await CarRepository.get_by_id(car_id)
    if not car or car["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    
    body = await request.json()
    image_url = body.get("image_url")
    is_main = body.get("is_main", False)
    
    if not image_url:
        raise HTTPException(status_code=400, detail="Bild-URL erforderlich")
    
    await CarRepository.add_image(car_id, image_url, is_main)
    
    return {"ok": True}


@router.post("/vendor/cars/{car_id}/extras")
async def add_car_extra(car_id: str, req: CarExtraCreate, request: Request):
    """Add extra option to car."""
    user, vendor_id, role = await require_vendor_access(request)
    
    car = await CarRepository.get_by_id(car_id)
    if not car or car["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    
    extra = {
        "extra_id": secrets.token_hex(4),
        "name": req.name,
        "description": req.description,
        "price_per_day": req.price_per_day,
        "price_per_rental": req.price_per_rental,
        "is_active": True,
    }
    
    await CarRepository.add_extra(car_id, extra)
    
    return {"ok": True, "extra": extra}


@router.delete("/vendor/cars/{car_id}/extras/{extra_id}")
async def remove_car_extra(car_id: str, extra_id: str, request: Request):
    """Remove extra from car."""
    user, vendor_id, role = await require_vendor_access(request)
    
    car = await CarRepository.get_by_id(car_id)
    if not car or car["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    
    await CarRepository.remove_extra(car_id, extra_id)
    
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR - BOOKING MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vendor/bookings")
async def list_vendor_bookings(
    request: Request,
    status: Optional[BookingStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """List vendor's bookings."""
    user, vendor_id, role = await require_vendor_access(request)
    
    status_val = status.value if status else None
    bookings = await BookingRepository.list_by_vendor(vendor_id, status=status_val, limit=limit, skip=skip)
    
    return {"bookings": bookings}


@router.get("/vendor/bookings/{booking_id}")
async def get_vendor_booking(booking_id: str, request: Request):
    """Get booking details."""
    user, vendor_id, role = await require_vendor_access(request)
    
    booking = await BookingRepository.get_by_id(booking_id)
    if not booking or booking["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")
    
    return {"booking": booking}


@router.post("/vendor/bookings/{booking_id}/approve")
async def approve_booking(booking_id: str, request: Request):
    """Approve booking."""
    user, vendor_id, role = await require_vendor_access(request)
    
    success, error = await BookingService.approve_booking(booking_id, vendor_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.post("/vendor/bookings/{booking_id}/reject")
async def reject_booking(booking_id: str, request: Request):
    """Reject booking."""
    user, vendor_id, role = await require_vendor_access(request)
    
    body = await request.json()
    reason = body.get("reason")
    
    success, error = await BookingService.reject_booking(booking_id, vendor_id, reason)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.post("/vendor/bookings/{booking_id}/ready")
async def mark_ready_for_handover(booking_id: str, request: Request):
    """Mark booking ready for handover."""
    user, vendor_id, role = await require_vendor_access(request)
    
    success, error = await BookingService.mark_ready_for_handover(booking_id, vendor_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.post("/vendor/bookings/{booking_id}/handover")
async def complete_handover(booking_id: str, req: HandoverRequest, request: Request):
    """Complete vehicle handover."""
    user, vendor_id, role = await require_vendor_access(request)
    
    handover_data = req.dict()
    handover_data["recorded_by"] = str(user["_id"])
    
    success, error = await BookingService.complete_handover(booking_id, vendor_id, handover_data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.post("/vendor/bookings/{booking_id}/return")
async def complete_return(booking_id: str, req: ReturnRequest, request: Request):
    """Complete vehicle return."""
    user, vendor_id, role = await require_vendor_access(request)
    
    return_data = req.dict()
    return_data["recorded_by"] = str(user["_id"])
    
    result, error = await BookingService.complete_return(booking_id, vendor_id, return_data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True, **result}


@router.post("/vendor/bookings/{booking_id}/cancel")
async def vendor_cancel_booking(booking_id: str, request: Request):
    """Cancel booking (vendor)."""
    user, vendor_id, role = await require_vendor_access(request)
    
    vendor = await VendorRepository.get_by_id(vendor_id)
    
    success, error = await BookingService.cancel_booking(booking_id, vendor["user_id"], is_vendor=True)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.post("/vendor/bookings/{booking_id}/charge")
async def add_extra_charge(booking_id: str, req: BookingExtraCharge, request: Request):
    """Add extra charge to booking."""
    user, vendor_id, role = await require_vendor_access(request)
    
    booking = await BookingRepository.get_by_id(booking_id)
    if not booking or booking["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")
    
    charge = {
        **req.dict(),
        "added_by": str(user["_id"]),
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await BookingRepository.add_extra_charge(booking_id, charge)
    
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR - INVOICES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vendor/invoices")
async def list_vendor_invoices(
    request: Request,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200)
):
    """List vendor's invoices."""
    user, vendor_id, role = await require_vendor_access(request)
    
    invoices = await InvoiceRepository.list_by_vendor(vendor_id, status=status, limit=limit)
    
    return {"invoices": invoices}


@router.post("/vendor/invoices/generate")
async def generate_invoice(req: InvoiceGenerateRequest, request: Request):
    """Generate invoice for booking."""
    user, vendor_id, role = await require_vendor_access(request)
    
    invoice, error = await InvoiceService.generate_invoice(
        req.booking_id, vendor_id,
        {
            "include_deposit": req.include_deposit,
            "discount_amount": req.discount_amount,
            "discount_reason": req.discount_reason,
            "notes": req.notes,
        }
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True, "invoice": invoice}


@router.get("/vendor/invoices/{invoice_id}")
async def get_vendor_invoice(invoice_id: str, request: Request):
    """Get invoice details."""
    user, vendor_id, role = await require_vendor_access(request)
    
    invoice = await InvoiceRepository.get_by_id(invoice_id)
    if not invoice or invoice["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    
    return {"invoice": invoice}


@router.post("/vendor/invoices/{invoice_id}/paid")
async def mark_invoice_paid(invoice_id: str, request: Request):
    """Mark invoice as paid."""
    user, vendor_id, role = await require_vendor_access(request)
    
    body = await request.json()
    paid_amount = body.get("paid_amount")
    
    success, error = await InvoiceService.mark_invoice_paid(invoice_id, vendor_id, paid_amount)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR - CONTRACTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vendor/contracts")
async def list_vendor_contracts(request: Request, limit: int = Query(50, ge=1, le=200)):
    """List vendor's contracts."""
    user, vendor_id, role = await require_vendor_access(request)
    
    contracts = await ContractRepository.list_by_vendor(vendor_id, limit=limit)
    
    return {"contracts": contracts}


@router.post("/vendor/contracts/generate")
async def generate_contract(req: ContractGenerateRequest, request: Request):
    """Generate contract for booking."""
    user, vendor_id, role = await require_vendor_access(request)
    
    contract, error = await ContractService.generate_contract(
        req.booking_id, vendor_id, req.template_id
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True, "contract": contract}


@router.get("/vendor/contracts/{contract_id}")
async def get_vendor_contract(contract_id: str, request: Request):
    """Get contract details."""
    user, vendor_id, role = await require_vendor_access(request)
    
    contract = await ContractRepository.get_by_id(contract_id)
    if not contract or contract["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Vertrag nicht gefunden")
    
    return {"contract": contract}


@router.post("/vendor/contracts/{contract_id}/sign")
async def sign_contract_vendor(contract_id: str, request: Request):
    """Sign contract (vendor)."""
    user, vendor_id, role = await require_vendor_access(request)
    
    body = await request.json()
    signature = body.get("signature", "")
    
    success, error = await ContractService.sign_contract(contract_id, "vendor", signature)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.get("/vendor/contract-templates")
async def list_contract_templates(request: Request):
    """List contract templates."""
    user, vendor_id, role = await require_vendor_access(request)
    
    templates = await ContractRepository.get_templates(vendor_id)
    
    return {"templates": templates}


@router.post("/vendor/contract-templates")
async def create_contract_template(req: ContractTemplateCreate, request: Request):
    """Create contract template."""
    user, vendor_id, role = await require_vendor_access(request)
    
    if role not in ["owner", "manager"]:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    template = await ContractRepository.create_template(vendor_id, req.dict())
    
    return {"ok": True, "template": template}


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR - DAMAGE REPORTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vendor/damages")
async def list_vendor_damages(
    request: Request,
    resolved: Optional[bool] = None
):
    """List damage reports."""
    user, vendor_id, role = await require_vendor_access(request)
    
    damages = await DamageRepository.list_by_vendor(vendor_id, resolved=resolved)
    
    return {"damages": damages}


@router.post("/vendor/damages")
async def create_damage_report(req: DamageReportCreate, request: Request):
    """Create damage report."""
    user, vendor_id, role = await require_vendor_access(request)
    
    # Verify booking belongs to vendor
    booking = await BookingRepository.get_by_id(req.booking_id)
    if not booking or booking["vendor_id"] != vendor_id:
        raise HTTPException(status_code=400, detail="Ungültige Buchung")
    
    damage_data = req.dict()
    damage_data["vendor_id"] = vendor_id
    damage_data["reported_by"] = str(user["_id"])
    
    damage = await DamageRepository.create(damage_data)
    
    return {"ok": True, "damage": damage}


@router.put("/vendor/damages/{damage_id}")
async def update_damage_report(damage_id: str, req: DamageReportUpdate, request: Request):
    """Update damage report."""
    user, vendor_id, role = await require_vendor_access(request)
    
    damage = await DamageRepository.get_by_id(damage_id)
    if not damage or damage["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Schadensmeldung nicht gefunden")
    
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if req.severity:
        update_data["severity"] = req.severity.value
    
    updated = await DamageRepository.update(damage_id, update_data)
    
    return {"ok": True, "damage": updated}


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR - STAFF MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vendor/staff")
async def list_vendor_staff(request: Request):
    """List vendor staff."""
    user, vendor_id, role = await require_vendor_access(request)
    
    if role != "owner":
        raise HTTPException(status_code=403, detail="Nur für Inhaber")
    
    staff = await StaffRepository.list_by_vendor(vendor_id)
    
    return {"staff": staff}


@router.post("/vendor/staff")
async def add_vendor_staff(req: StaffCreateRequest, request: Request):
    """Add staff member."""
    user, vendor_id, role = await require_vendor_access(request)
    
    if role != "owner":
        raise HTTPException(status_code=403, detail="Nur für Inhaber")
    
    # Find user by email
    staff_user = await db.users.find_one({"email": req.email}, {"_id": 1, "name": 1, "email": 1})
    if not staff_user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Check if already staff
    existing = await StaffRepository.get_by_user_vendor(str(staff_user["_id"]), vendor_id)
    if existing:
        raise HTTPException(status_code=400, detail="Benutzer ist bereits Mitarbeiter")
    
    staff_data = {
        "name": req.name or staff_user.get("name", ""),
        "email": req.email,
        "role": req.role.value,
        "permissions": req.permissions,
    }
    
    staff = await StaffRepository.create(vendor_id, str(staff_user["_id"]), staff_data)
    
    return {"ok": True, "staff": staff}


@router.put("/vendor/staff/{user_id}")
async def update_vendor_staff(user_id: str, req: StaffUpdateRequest, request: Request):
    """Update staff member."""
    user, vendor_id, role = await require_vendor_access(request)
    
    if role != "owner":
        raise HTTPException(status_code=403, detail="Nur für Inhaber")
    
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if req.role:
        update_data["role"] = req.role.value
    
    await StaffRepository.update(vendor_id, user_id, update_data)
    
    return {"ok": True}


@router.delete("/vendor/staff/{user_id}")
async def remove_vendor_staff(user_id: str, request: Request):
    """Remove staff member."""
    user, vendor_id, role = await require_vendor_access(request)
    
    if role != "owner":
        raise HTTPException(status_code=403, detail="Nur für Inhaber")
    
    await StaffRepository.delete(vendor_id, user_id)
    
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR - PAYOUTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vendor/payouts")
async def list_vendor_payouts(request: Request, status: Optional[str] = None):
    """List vendor payouts."""
    user, vendor_id, role = await require_vendor_access(request)
    
    payouts = await PayoutRepository.list_by_vendor(vendor_id, status=status)
    
    return {"payouts": payouts}


@router.post("/vendor/payouts/request")
async def request_payout(req: PayoutRequest, request: Request):
    """Request payout."""
    user, vendor_id, role = await require_vendor_access(request)
    
    if role not in ["owner", "manager"]:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    payout, error = await PayoutService.request_payout(vendor_id, req.amount)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True, "payout": payout}


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR - CUSTOMERS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vendor/customers")
async def list_vendor_customers(request: Request, limit: int = Query(50, ge=1, le=200)):
    """List customers who booked from this vendor."""
    user, vendor_id, role = await require_vendor_access(request)
    
    # Get unique customers from bookings
    pipeline = [
        {"$match": {"vendor_id": vendor_id}},
        {"$group": {
            "_id": "$customer_id",
            "customer_name": {"$first": "$customer_name"},
            "customer_email": {"$first": "$customer_email"},
            "total_bookings": {"$sum": 1},
            "total_spent": {"$sum": "$total_amount"},
            "last_booking": {"$max": "$created_at"},
        }},
        {"$sort": {"last_booking": -1}},
        {"$limit": limit},
    ]
    
    customers = await db.car_rental_bookings.aggregate(pipeline).to_list(limit)
    
    return {"customers": sanitize_doc(customers)}


@router.get("/vendor/customers/{customer_id}")
async def get_vendor_customer(customer_id: str, request: Request):
    """Get customer details and history."""
    user, vendor_id, role = await require_vendor_access(request)
    
    # Get customer's bookings with this vendor
    bookings = await BookingRepository.list_by_vendor(vendor_id)
    customer_bookings = [b for b in bookings if b["customer_id"] == customer_id]
    
    if not customer_bookings:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    # Get customer documents
    documents = await CustomerDocumentRepository.get_by_customer(customer_id)
    
    # Get damage reports involving this customer
    damages = []
    for b in customer_bookings:
        car_damages = await DamageRepository.list_by_car(b["car_id"])
        booking_damages = [d for d in car_damages if d.get("booking_id") == b["booking_id"]]
        damages.extend(booking_damages)
    
    customer_info = {
        "customer_id": customer_id,
        "name": customer_bookings[0].get("customer_name", ""),
        "email": customer_bookings[0].get("customer_email", ""),
        "total_bookings": len(customer_bookings),
        "total_spent": sum(b.get("total_amount", 0) for b in customer_bookings),
        "bookings": customer_bookings,
        "documents": documents,
        "damages": damages,
    }
    
    return {"customer": customer_info}


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR - REPORTS & ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/vendor/reports/summary")
async def get_vendor_report_summary(request: Request, days: int = Query(30, ge=7, le=365)):
    """Get vendor revenue and booking summary."""
    user, vendor_id, role = await require_vendor_access(request)
    
    stats = await BookingRepository.get_vendor_stats(vendor_id, days)
    
    # Get cars with stats
    cars = await CarRepository.list_by_vendor(vendor_id)
    top_cars = sorted(cars, key=lambda c: c.get("total_revenue", 0), reverse=True)[:5]
    
    return {
        "period_days": days,
        "stats": stats,
        "top_cars": top_cars,
    }


@router.get("/vendor/activity-log")
async def get_vendor_activity_log(request: Request, limit: int = Query(100, ge=10, le=500)):
    """Get vendor activity log."""
    user, vendor_id, role = await require_vendor_access(request)
    
    logs = await ActivityLogRepository.list_by_vendor(vendor_id, limit=limit)
    
    return {"logs": logs}


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/bookings")
async def create_booking(req: BookingCreateRequest, request: Request):
    """Create booking (customer)."""
    user = await get_current_user(request)
    
    booking, error = await BookingService.create_booking(str(user["_id"]), req.dict())
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True, "booking": booking}


@router.post("/bookings/{booking_id}/pay")
async def pay_booking(booking_id: str, request: Request):
    """Pay for booking."""
    user = await get_current_user(request)
    
    success, error = await BookingService.process_booking_payment(booking_id, str(user["_id"]))
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.get("/my-bookings")
async def list_my_bookings(request: Request, limit: int = Query(50, ge=1, le=200)):
    """List customer's bookings."""
    user = await get_current_user(request)
    
    bookings = await BookingRepository.list_by_customer(str(user["_id"]), limit=limit)
    
    return {"bookings": bookings}


@router.get("/my-bookings/{booking_id}")
async def get_my_booking(booking_id: str, request: Request):
    """Get customer's booking details."""
    user = await get_current_user(request)
    
    booking = await BookingRepository.get_by_id(booking_id)
    if not booking or booking["customer_id"] != str(user["_id"]):
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")
    
    # Get contract and invoice if they exist
    contract = await ContractRepository.get_by_booking(booking_id)
    invoice = await InvoiceRepository.get_by_booking(booking_id)
    
    return {
        "booking": booking,
        "contract": contract,
        "invoice": invoice,
    }


@router.post("/my-bookings/{booking_id}/cancel")
async def cancel_my_booking(booking_id: str, request: Request):
    """Cancel customer's booking."""
    user = await get_current_user(request)
    
    success, error = await BookingService.cancel_booking(booking_id, str(user["_id"]), is_vendor=False)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.post("/my-bookings/{booking_id}/sign-contract")
async def sign_my_contract(booking_id: str, request: Request):
    """Sign contract (customer)."""
    user = await get_current_user(request)
    
    booking = await BookingRepository.get_by_id(booking_id)
    if not booking or booking["customer_id"] != str(user["_id"]):
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")
    
    contract = await ContractRepository.get_by_booking(booking_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Vertrag nicht gefunden")
    
    body = await request.json()
    signature = body.get("signature", "")
    
    success, error = await ContractService.sign_contract(contract["contract_id"], "customer", signature)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.get("/my-invoices")
async def list_my_invoices(request: Request, limit: int = Query(50, ge=1, le=200)):
    """List customer's invoices."""
    user = await get_current_user(request)
    
    invoices = await InvoiceRepository.list_by_customer(str(user["_id"]), limit=limit)
    
    return {"invoices": invoices}


@router.post("/my-documents")
async def upload_my_document(req: CustomerDocumentUpload, request: Request):
    """Upload document (customer)."""
    user = await get_current_user(request)
    
    doc = await CustomerDocumentRepository.create(str(user["_id"]), req.dict())
    
    return {"ok": True, "document": doc}


@router.get("/my-documents")
async def list_my_documents(request: Request):
    """List customer's documents."""
    user = await get_current_user(request)
    
    documents = await CustomerDocumentRepository.get_by_customer(str(user["_id"]))
    
    return {"documents": documents}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/overview")
async def admin_overview(request: Request):
    """Admin overview of car rental module."""
    await require_admin(request)
    
    # Count vendors
    total_vendors = await db.car_rental_vendors.count_documents({})
    pending_vendors = await db.car_rental_vendors.count_documents({"status": VendorStatus.PENDING.value})
    approved_vendors = await db.car_rental_vendors.count_documents({"status": VendorStatus.APPROVED.value})
    
    # Count cars
    total_cars = await db.car_rental_cars.count_documents({"status": {"$ne": CarStatus.ARCHIVED.value}})
    
    # Count bookings
    total_bookings = await db.car_rental_bookings.count_documents({})
    active_bookings = await db.car_rental_bookings.count_documents({"status": BookingStatus.ACTIVE.value})
    
    # Revenue (completed bookings)
    pipeline = [
        {"$match": {"status": BookingStatus.COMPLETED.value}},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$total_amount"},
            "commission": {"$sum": "$commission_amount"},
        }}
    ]
    revenue = await db.car_rental_bookings.aggregate(pipeline).to_list(1)
    revenue_data = revenue[0] if revenue else {"total": 0, "commission": 0}
    
    # Pending payouts
    pending_payouts = await db.car_rental_payouts.count_documents({"status": "pending"})
    
    return {
        "vendors": {
            "total": total_vendors,
            "pending": pending_vendors,
            "approved": approved_vendors,
        },
        "cars": total_cars,
        "bookings": {
            "total": total_bookings,
            "active": active_bookings,
        },
        "revenue": {
            "total": revenue_data.get("total", 0),
            "platform_commission": revenue_data.get("commission", 0),
        },
        "pending_payouts": pending_payouts,
    }


@router.get("/admin/vendors")
async def admin_list_vendors(
    request: Request,
    status: Optional[VendorStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """Admin list vendors."""
    await require_admin(request)
    
    status_val = status.value if status else None
    vendors = await VendorRepository.list_all(status=status_val, limit=limit, skip=skip)
    
    return {"vendors": vendors}


@router.post("/admin/vendors/{vendor_id}/action")
async def admin_vendor_action(vendor_id: str, req: AdminVendorAction, request: Request):
    """Admin approve/suspend/reject vendor."""
    await require_admin(request)
    
    status_map = {
        "approve": VendorStatus.APPROVED,
        "suspend": VendorStatus.SUSPENDED,
        "reject": VendorStatus.REJECTED,
    }
    
    new_status = status_map.get(req.action)
    if not new_status:
        raise HTTPException(status_code=400, detail="Ungültige Aktion")
    
    success = await VendorRepository.update_status(vendor_id, new_status, req.reason)
    if not success:
        raise HTTPException(status_code=404, detail="Vermieter nicht gefunden")
    
    return {"ok": True}


@router.put("/admin/vendors/{vendor_id}/commission")
async def admin_set_vendor_commission(vendor_id: str, req: AdminCommissionUpdate, request: Request):
    """Admin set vendor commission."""
    await require_admin(request)
    
    await VendorRepository.update(vendor_id, {"commission_percent": req.commission_percent})
    
    return {"ok": True}


@router.get("/admin/bookings")
async def admin_list_bookings(
    request: Request,
    status: Optional[BookingStatus] = None,
    vendor_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200)
):
    """Admin list all bookings."""
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status.value
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    bookings = await db.car_rental_bookings.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"bookings": sanitize_doc(bookings)}


@router.get("/admin/payouts")
async def admin_list_payouts(
    request: Request,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200)
):
    """Admin list payouts."""
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status
    
    payouts = await db.car_rental_payouts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with vendor info
    for p in payouts:
        vendor = await VendorRepository.get_by_id(p["vendor_id"])
        if vendor:
            p["vendor_name"] = vendor["company"]["company_name"]
    
    return {"payouts": sanitize_doc(payouts)}


@router.post("/admin/payouts/{payout_id}/process")
async def admin_process_payout(payout_id: str, req: PayoutStatusUpdate, request: Request):
    """Admin process payout."""
    await require_admin(request)
    
    success, error = await PayoutService.process_payout(payout_id, req.status, req.transaction_ref)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    return {"ok": True}


@router.get("/admin/settings")
async def admin_get_settings(request: Request):
    """Get car rental module settings."""
    await require_admin(request)
    
    settings = await db.car_rental_settings.find_one({"_id": "global"}, {"_id": 0})
    
    if not settings:
        settings = {
            "default_commission": 15.0,
            "min_payout_amount": 50.0,
            "payout_schedule": "weekly",
            "require_vendor_verification": True,
            "max_booking_days": 90,
        }
    
    return {"settings": settings}


@router.put("/admin/settings")
async def admin_update_settings(req: AdminSettingsUpdate, request: Request):
    """Update car rental module settings."""
    await require_admin(request)
    
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    
    await db.car_rental_settings.update_one(
        {"_id": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# FILE UPLOAD - CAR IMAGES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/vendor/cars/{car_id}/upload-image")
async def upload_car_image(car_id: str, request: Request, file: UploadFile = File(...)):
    """Upload image for a car (vendor)."""
    user, vendor_id, role = await require_vendor_access(request)
    
    car = await CarRepository.get_by_id(car_id)
    if not car or car["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    
    # Validate file
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Nur JPG, PNG und WebP erlaubt")
    
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max. 10 MB pro Bild")
    
    from pathlib import Path
    import uuid
    
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{car_id}_{uuid.uuid4().hex[:8]}.{ext}"
    upload_dir = Path(__file__).parent.parent.parent / "uploads" / "car_rental"
    upload_dir.mkdir(parents=True, exist_ok=True)
    filepath = upload_dir / filename
    
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    image_url = f"/api/uploads/car_rental/{filename}"
    
    # Check if this is the first image (make it main)
    is_main = not car.get("main_image")
    await CarRepository.add_image(car_id, image_url, is_main)
    
    return {"ok": True, "image_url": image_url, "is_main": is_main}


@router.post("/vendor/cars/{car_id}/set-main-image")
async def set_main_image(car_id: str, request: Request):
    """Set main image for car."""
    user, vendor_id, role = await require_vendor_access(request)
    
    car = await CarRepository.get_by_id(car_id)
    if not car or car["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    
    body = await request.json()
    image_url = body.get("image_url")
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url erforderlich")
    
    await db.car_rental_cars.update_one(
        {"car_id": car_id},
        {"$set": {"main_image": image_url}}
    )
    return {"ok": True}


@router.delete("/vendor/cars/{car_id}/images")
async def delete_car_image(car_id: str, request: Request):
    """Delete image from car."""
    user, vendor_id, role = await require_vendor_access(request)
    
    car = await CarRepository.get_by_id(car_id)
    if not car or car["vendor_id"] != vendor_id:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    
    body = await request.json()
    image_url = body.get("image_url")
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url erforderlich")
    
    # Remove from gallery
    await db.car_rental_cars.update_one(
        {"car_id": car_id},
        {"$pull": {"gallery_images": image_url}}
    )
    
    # If it was main image, clear it
    if car.get("main_image") == image_url:
        gallery = car.get("gallery_images", [])
        remaining = [g for g in gallery if g != image_url]
        new_main = remaining[0] if remaining else None
        await db.car_rental_cars.update_one(
            {"car_id": car_id},
            {"$set": {"main_image": new_main}}
        )
    
    # Delete file from disk
    from pathlib import Path
    if image_url.startswith("/api/uploads/"):
        filename = image_url.split("/")[-1]
        filepath = Path(__file__).parent.parent.parent / "uploads" / "car_rental" / filename
        if filepath.exists():
            filepath.unlink()
    
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# REVIEWS & RATINGS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/reviews")
async def create_review(request: Request):
    """Create a review for a completed booking."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    body = await request.json()
    booking_id = body.get("booking_id")
    rating = body.get("rating")
    comment = body.get("comment", "")
    
    if not booking_id or not rating:
        raise HTTPException(status_code=400, detail="booking_id und rating erforderlich")
    
    if not (1 <= int(rating) <= 5):
        raise HTTPException(status_code=400, detail="Bewertung muss 1-5 sein")
    
    # Verify booking
    booking = await BookingRepository.get_by_id(booking_id)
    if not booking or booking["customer_id"] != user_id:
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")
    
    if booking["status"] != "completed":
        raise HTTPException(status_code=400, detail="Nur abgeschlossene Buchungen können bewertet werden")
    
    # Check if already reviewed
    existing = await db.car_rental_reviews.find_one({"booking_id": booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Bereits bewertet")
    
    from .models import generate_review_id
    review_id = generate_review_id()
    now = datetime.now(timezone.utc).isoformat()
    
    review = {
        "review_id": review_id,
        "booking_id": booking_id,
        "car_id": booking["car_id"],
        "vendor_id": booking["vendor_id"],
        "customer_id": user_id,
        "customer_name": user.get("name", ""),
        "rating": int(rating),
        "comment": comment,
        "created_at": now,
    }
    
    await db.car_rental_reviews.insert_one(review)
    
    # Update car rating
    pipeline = [
        {"$match": {"car_id": booking["car_id"]}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    stats = await db.car_rental_reviews.aggregate(pipeline).to_list(1)
    if stats:
        await db.car_rental_cars.update_one(
            {"car_id": booking["car_id"]},
            {"$set": {"rating": round(stats[0]["avg"], 1), "review_count": stats[0]["count"]}}
        )
    
    # Update vendor rating
    pipeline2 = [
        {"$match": {"vendor_id": booking["vendor_id"]}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    vstats = await db.car_rental_reviews.aggregate(pipeline2).to_list(1)
    if vstats:
        await db.car_rental_vendors.update_one(
            {"vendor_id": booking["vendor_id"]},
            {"$set": {"rating": round(vstats[0]["avg"], 1), "review_count": vstats[0]["count"]}}
        )
    
    return {"ok": True, "review": sanitize_doc(review)}


@router.get("/cars/{car_id}/reviews")
async def get_car_reviews(car_id: str, limit: int = Query(20, ge=1, le=100)):
    """Get reviews for a car (public)."""
    reviews = await db.car_rental_reviews.find(
        {"car_id": car_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"reviews": sanitize_doc(reviews)}


@router.get("/vendors/{vendor_id}/reviews")
async def get_vendor_reviews(vendor_id: str, limit: int = Query(20, ge=1, le=100)):
    """Get reviews for a vendor (public)."""
    reviews = await db.car_rental_reviews.find(
        {"vendor_id": vendor_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"reviews": sanitize_doc(reviews)}


# ══════════════════════════════════════════════════════════════════════════════
# RECEIPT / INVOICE PDF EXPORT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: str, request: Request):
    """Download invoice as PDF."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    invoice = await InvoiceRepository.get_by_id(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    
    # Check access (customer or vendor)
    is_customer = invoice.get("customer_id") == user_id
    is_vendor = False
    if not is_customer:
        vendor = await VendorRepository.get_by_user_id(user_id)
        if vendor and vendor["vendor_id"] == invoice.get("vendor_id"):
            is_vendor = True
    is_admin = user.get("role") in ["admin", "super_admin"]
    
    if not (is_customer or is_vendor or is_admin):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    # Get booking info
    booking = await BookingRepository.get_by_id(invoice.get("booking_id", ""))
    vendor_doc = await VendorRepository.get_by_id(invoice.get("vendor_id", ""))
    
    # Generate PDF
    from .pdf_generator import generate_invoice_pdf
    pdf_bytes = generate_invoice_pdf(invoice, booking, vendor_doc)
    
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Rechnung_{invoice.get("invoice_number", invoice_id)}.pdf"'
        }
    )


@router.get("/bookings/{booking_id}/receipt-pdf")
async def download_booking_receipt(booking_id: str, request: Request):
    """Download booking receipt as PDF."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    booking = await BookingRepository.get_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Buchung nicht gefunden")
    
    # Check access
    is_customer = booking.get("customer_id") == user_id
    is_vendor = False
    if not is_customer:
        vendor = await VendorRepository.get_by_user_id(user_id)
        if vendor and vendor["vendor_id"] == booking.get("vendor_id"):
            is_vendor = True
    is_admin = user.get("role") in ["admin", "super_admin"]
    
    if not (is_customer or is_vendor or is_admin):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    vendor_doc = await VendorRepository.get_by_id(booking.get("vendor_id", ""))
    
    from .pdf_generator import generate_receipt_pdf
    pdf_bytes = generate_receipt_pdf(booking, vendor_doc)
    
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Beleg_{booking_id}.pdf"'
        }
    )
