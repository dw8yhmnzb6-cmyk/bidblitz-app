"""
BidBlitz V2 - Car Rental Services
Business logic layer for car rental operations.
"""

from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from core.database import db
from core.payment_engine import debit_wallet, credit_wallet, TransactionType, PaymentResult

from .models import (
    VendorStatus, CarStatus, BookingStatus, PaymentStatus, InvoiceStatus,
    generate_booking_id
)
from .repository import (
    VendorRepository, CarRepository, BookingRepository, InvoiceRepository,
    ContractRepository, DamageRepository, StaffRepository, PayoutRepository,
    CustomerDocumentRepository, ActivityLogRepository
)


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR SERVICE
# ══════════════════════════════════════════════════════════════════════════════

class VendorService:
    
    @classmethod
    async def register_vendor(cls, user_id: str, data: dict) -> Tuple[dict, str]:
        """Register a new car rental vendor."""
        # Check if user already has a vendor account
        existing = await VendorRepository.get_by_user_id(user_id)
        if existing:
            return None, "Sie haben bereits ein Vermieter-Konto"
        
        # Create vendor
        vendor = await VendorRepository.create(user_id, data)
        
        # Update user role to include car_rental_vendor
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$addToSet": {"roles": "car_rental_vendor"}}
        )
        
        return vendor, None
    
    @classmethod
    async def get_vendor_dashboard(cls, vendor_id: str) -> dict:
        """Get vendor dashboard summary."""
        vendor = await VendorRepository.get_by_id(vendor_id)
        if not vendor:
            return None
        
        # Get booking stats
        booking_stats = await BookingRepository.get_vendor_stats(vendor_id)
        
        # Get active bookings
        active_bookings = await BookingRepository.list_by_vendor(
            vendor_id, status=BookingStatus.ACTIVE.value, limit=5
        )
        
        # Get cars
        cars = await CarRepository.list_by_vendor(vendor_id)
        
        # Calculate fleet status
        fleet_status = {
            "total": len(cars),
            "available": len([c for c in cars if c["status"] == CarStatus.AVAILABLE.value]),
            "rented": len([c for c in cars if c["status"] == CarStatus.RENTED.value]),
            "maintenance": len([c for c in cars if c["status"] == CarStatus.MAINTENANCE.value]),
        }
        
        # Get unpaid invoices
        unpaid_invoices = await InvoiceRepository.list_by_vendor(
            vendor_id, status=InvoiceStatus.ISSUED.value, limit=10
        )
        
        return {
            "vendor": vendor,
            "stats": booking_stats,
            "fleet_status": fleet_status,
            "active_bookings": active_bookings,
            "unpaid_invoices": unpaid_invoices,
            "pending_payout": vendor.get("pending_payout", 0),
            "total_revenue": vendor.get("total_revenue", 0),
        }
    
    @classmethod
    async def can_access_vendor(cls, user_id: str, vendor_id: str) -> Tuple[bool, str]:
        """Check if user can access vendor resources."""
        vendor = await VendorRepository.get_by_id(vendor_id)
        if not vendor:
            return False, None
        
        # Owner access
        if vendor["user_id"] == user_id:
            return True, "owner"
        
        # Staff access
        staff = await StaffRepository.get_by_user_vendor(user_id, vendor_id)
        if staff and staff.get("is_active"):
            return True, staff.get("role", "employee")
        
        return False, None


# ══════════════════════════════════════════════════════════════════════════════
# CAR SERVICE
# ══════════════════════════════════════════════════════════════════════════════

class CarService:
    
    @classmethod
    async def create_car(cls, vendor_id: str, data: dict) -> Tuple[dict, str]:
        """Create a new car listing."""
        vendor = await VendorRepository.get_by_id(vendor_id)
        if not vendor:
            return None, "Vermieter nicht gefunden"
        
        if vendor["status"] != VendorStatus.APPROVED.value:
            return None, "Ihr Vermieter-Konto ist nicht genehmigt"
        
        car = await CarRepository.create(vendor_id, data)
        
        await ActivityLogRepository.log(
            vendor_id, vendor["user_id"], "create", "car", car["car_id"],
            {"title": data.get("title")}
        )
        
        return car, None
    
    @classmethod
    async def update_car(cls, car_id: str, vendor_id: str, data: dict) -> Tuple[dict, str]:
        """Update car details."""
        car = await CarRepository.get_by_id(car_id)
        if not car:
            return None, "Fahrzeug nicht gefunden"
        
        if car["vendor_id"] != vendor_id:
            return None, "Keine Berechtigung"
        
        updated = await CarRepository.update(car_id, data)
        return updated, None
    
    @classmethod
    async def archive_car(cls, car_id: str, vendor_id: str) -> Tuple[bool, str]:
        """Archive a car (soft delete)."""
        car = await CarRepository.get_by_id(car_id)
        if not car:
            return False, "Fahrzeug nicht gefunden"
        
        if car["vendor_id"] != vendor_id:
            return False, "Keine Berechtigung"
        
        # Check for active bookings
        bookings = await BookingRepository.list_by_vendor(vendor_id)
        active = [b for b in bookings if b["car_id"] == car_id and b["status"] in [
            BookingStatus.CONFIRMED.value, BookingStatus.ACTIVE.value
        ]]
        
        if active:
            return False, "Fahrzeug hat aktive Buchungen"
        
        await CarRepository.update_status(car_id, CarStatus.ARCHIVED)
        await VendorRepository.increment_stats(vendor_id, "total_cars", -1)
        
        return True, None
    
    @classmethod
    async def get_car_detail_public(cls, car_id: str) -> Optional[dict]:
        """Get car details for public view."""
        car = await CarRepository.get_by_id(car_id)
        if not car or car["status"] == CarStatus.ARCHIVED.value:
            return None
        
        vendor = await VendorRepository.get_by_id(car["vendor_id"])
        if not vendor or vendor["status"] != VendorStatus.APPROVED.value:
            return None
        
        # Add vendor info (limited)
        car["vendor"] = {
            "vendor_id": vendor["vendor_id"],
            "company_name": vendor["company"]["company_name"],
            "city": vendor["company"]["city"],
            "rating": vendor.get("rating", 0),
            "review_count": vendor.get("review_count", 0),
        }
        
        return car
    
    @classmethod
    async def calculate_rental_price(cls, car_id: str, start_date: str, end_date: str, extras: List[str] = None) -> dict:
        """Calculate total rental price including extras."""
        car = await CarRepository.get_by_id(car_id)
        if not car:
            return None
        
        # Parse dates
        start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        
        days = (end - start).days
        if days < 1:
            days = 1
        
        # Calculate base price with discounts
        if days >= 30 and car.get("price_per_month"):
            months = days // 30
            remaining_days = days % 30
            base_price = (months * car["price_per_month"]) + (remaining_days * car["price_per_day"])
        elif days >= 7 and car.get("price_per_week"):
            weeks = days // 7
            remaining_days = days % 7
            base_price = (weeks * car["price_per_week"]) + (remaining_days * car["price_per_day"])
        else:
            base_price = days * car["price_per_day"]
        
        # Calculate extras
        extras_total = 0.0
        extras_breakdown = []
        
        if extras:
            for extra in car.get("extras", []):
                if extra["extra_id"] in extras and extra.get("is_active"):
                    if extra.get("price_per_rental"):
                        extra_cost = extra["price_per_rental"]
                    else:
                        extra_cost = extra["price_per_day"] * days
                    extras_total += extra_cost
                    extras_breakdown.append({
                        "name": extra["name"],
                        "cost": extra_cost
                    })
        
        subtotal = base_price + extras_total
        tax_amount = round(subtotal * 0.19, 2)  # 19% MwSt
        total = round(subtotal + tax_amount, 2)
        
        return {
            "days": days,
            "base_price": round(base_price, 2),
            "extras_total": round(extras_total, 2),
            "extras_breakdown": extras_breakdown,
            "subtotal": round(subtotal, 2),
            "tax_rate": 19.0,
            "tax_amount": tax_amount,
            "total": total,
            "deposit": car.get("deposit_amount", 500),
            "deductible": car.get("deductible", 1000),
        }


# ══════════════════════════════════════════════════════════════════════════════
# BOOKING SERVICE
# ══════════════════════════════════════════════════════════════════════════════

class BookingService:
    
    @classmethod
    async def create_booking(cls, customer_id: str, data: dict) -> Tuple[dict, str]:
        """Create a new booking."""
        car = await CarRepository.get_by_id(data["car_id"])
        if not car:
            return None, "Fahrzeug nicht gefunden"
        
        if car["status"] != CarStatus.AVAILABLE.value:
            return None, "Fahrzeug nicht verfügbar"
        
        vendor = await VendorRepository.get_by_id(car["vendor_id"])
        if not vendor or vendor["status"] != VendorStatus.APPROVED.value:
            return None, "Vermieter nicht verfügbar"
        
        # Check date availability
        is_available = await BookingRepository.check_availability(
            data["car_id"], data["start_date"], data["end_date"]
        )
        if not is_available:
            return None, "Fahrzeug ist in diesem Zeitraum nicht verfügbar"
        
        # Calculate pricing
        pricing = await CarService.calculate_rental_price(
            data["car_id"], data["start_date"], data["end_date"], data.get("extras", [])
        )
        
        if not pricing:
            return None, "Preisberechnung fehlgeschlagen"
        
        # Get customer info
        customer = await db.users.find_one({"_id": ObjectId(customer_id)})
        if not customer:
            return None, "Kunde nicht gefunden"
        
        booking_data = {
            "car_id": data["car_id"],
            "vendor_id": car["vendor_id"],
            "customer_id": customer_id,
            "customer_name": customer.get("name", ""),
            "customer_email": customer.get("email", ""),
            "start_date": data["start_date"],
            "end_date": data["end_date"],
            "pickup_time": data.get("pickup_time", "10:00"),
            "return_time": data.get("return_time", "10:00"),
            "extras": data.get("extras", []),
            "notes": data.get("notes"),
            "promo_code": data.get("promo_code"),
            
            # Car info snapshot
            "car_title": car["title"],
            "car_brand": car["brand"],
            "car_model": car["model"],
            "car_registration": car["registration_number"],
            
            # Pricing
            "rental_days": pricing["days"],
            "base_price": pricing["base_price"],
            "extras_total": pricing["extras_total"],
            "subtotal": pricing["subtotal"],
            "tax_amount": pricing["tax_amount"],
            "total_amount": pricing["total"],
            "deposit_amount": pricing["deposit"],
            
            # Commission
            "commission_percent": vendor.get("commission_percent", 15.0),
            "commission_amount": round(pricing["total"] * vendor.get("commission_percent", 15.0) / 100, 2),
            "vendor_share": round(pricing["total"] * (100 - vendor.get("commission_percent", 15.0)) / 100, 2),
        }
        
        booking = await BookingRepository.create(booking_data)
        
        # Log activity
        await ActivityLogRepository.log(
            car["vendor_id"], customer_id, "create", "booking", booking["booking_id"],
            {"car_id": data["car_id"], "total": pricing["total"]}
        )
        
        return booking, None
    
    @classmethod
    async def process_booking_payment(cls, booking_id: str, customer_id: str) -> Tuple[bool, str]:
        """Process payment for a booking using BidBlitz wallet."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return False, "Buchung nicht gefunden"
        
        if booking["customer_id"] != customer_id:
            return False, "Keine Berechtigung"
        
        if booking["payment_status"] == PaymentStatus.PAID.value:
            return False, "Bereits bezahlt"
        
        total_with_deposit = booking["total_amount"] + booking["deposit_amount"]
        
        # Debit customer wallet
        result = await debit_wallet(
            user_id=customer_id,
            amount=total_with_deposit,
            tx_type=TransactionType.PAYMENT,
            description=f"Autovermietung: {booking['car_title']}",
            reference=booking_id,
            metadata={
                "type": "car_rental_booking",
                "booking_id": booking_id,
                "vendor_id": booking["vendor_id"],
                "rental_amount": booking["total_amount"],
                "deposit_amount": booking["deposit_amount"],
            }
        )
        
        if not result.success:
            return False, result.error or "Zahlung fehlgeschlagen"
        
        # Update booking payment status
        await BookingRepository.update(booking_id, {
            "payment_status": PaymentStatus.PAID.value,
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "payment_transaction_id": result.transaction_id,
        })
        
        # Auto-approve if vendor setting is enabled
        vendor = await VendorRepository.get_by_id(booking["vendor_id"])
        if vendor and vendor.get("settings", {}).get("auto_approve_bookings"):
            await BookingRepository.update_status(booking_id, BookingStatus.CONFIRMED)
        
        # Update vendor pending payout
        await VendorRepository.increment_stats(
            booking["vendor_id"], "pending_payout", booking["vendor_share"]
        )
        
        return True, None
    
    @classmethod
    async def approve_booking(cls, booking_id: str, vendor_id: str) -> Tuple[bool, str]:
        """Vendor approves a booking."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return False, "Buchung nicht gefunden"
        
        if booking["vendor_id"] != vendor_id:
            return False, "Keine Berechtigung"
        
        if booking["status"] != BookingStatus.PENDING.value:
            return False, "Buchung kann nicht genehmigt werden"
        
        if booking["payment_status"] != PaymentStatus.PAID.value:
            return False, "Zahlung ausstehend"
        
        await BookingRepository.update_status(booking_id, BookingStatus.CONFIRMED)
        
        # Update car status to reserved
        await CarRepository.update_status(booking["car_id"], CarStatus.RESERVED)
        
        return True, None
    
    @classmethod
    async def reject_booking(cls, booking_id: str, vendor_id: str, reason: str = None) -> Tuple[bool, str]:
        """Vendor rejects a booking."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return False, "Buchung nicht gefunden"
        
        if booking["vendor_id"] != vendor_id:
            return False, "Keine Berechtigung"
        
        if booking["status"] not in [BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value]:
            return False, "Buchung kann nicht abgelehnt werden"
        
        # Refund customer if paid
        if booking["payment_status"] == PaymentStatus.PAID.value:
            refund_amount = booking["total_amount"] + booking["deposit_amount"]
            await credit_wallet(
                user_id=booking["customer_id"],
                amount=refund_amount,
                tx_type=TransactionType.REFUND,
                description=f"Rückerstattung: {booking['car_title']}",
                reference=booking_id,
            )
            
            # Update vendor pending payout
            await VendorRepository.increment_stats(
                vendor_id, "pending_payout", -booking["vendor_share"]
            )
        
        await BookingRepository.update(booking_id, {
            "status": BookingStatus.REJECTED.value,
            "rejection_reason": reason,
            "payment_status": PaymentStatus.REFUNDED.value if booking["payment_status"] == PaymentStatus.PAID.value else booking["payment_status"],
        })
        
        return True, None
    
    @classmethod
    async def mark_ready_for_handover(cls, booking_id: str, vendor_id: str) -> Tuple[bool, str]:
        """Mark booking as ready for vehicle handover."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return False, "Buchung nicht gefunden"
        
        if booking["vendor_id"] != vendor_id:
            return False, "Keine Berechtigung"
        
        if booking["status"] != BookingStatus.CONFIRMED.value:
            return False, "Buchung muss zuerst bestätigt werden"
        
        await BookingRepository.update_status(booking_id, BookingStatus.READY_FOR_HANDOVER)
        return True, None
    
    @classmethod
    async def complete_handover(cls, booking_id: str, vendor_id: str, handover_data: dict) -> Tuple[bool, str]:
        """Complete vehicle handover."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return False, "Buchung nicht gefunden"
        
        if booking["vendor_id"] != vendor_id:
            return False, "Keine Berechtigung"
        
        if booking["status"] != BookingStatus.READY_FOR_HANDOVER.value:
            return False, "Buchung ist nicht bereit für Übergabe"
        
        handover_record = {
            **handover_data,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        
        await BookingRepository.update(booking_id, {
            "status": BookingStatus.ACTIVE.value,
            "handover_record": handover_record,
            "actual_start_time": datetime.now(timezone.utc).isoformat(),
        })
        
        # Update car status
        await CarRepository.update_status(booking["car_id"], CarStatus.RENTED)
        
        # Update car mileage
        await CarRepository.update(booking["car_id"], {"mileage": handover_data["mileage"]})
        
        return True, None
    
    @classmethod
    async def complete_return(cls, booking_id: str, vendor_id: str, return_data: dict) -> Tuple[dict, str]:
        """Complete vehicle return."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return None, "Buchung nicht gefunden"
        
        if booking["vendor_id"] != vendor_id:
            return None, "Keine Berechtigung"
        
        if booking["status"] != BookingStatus.ACTIVE.value:
            return None, "Buchung ist nicht aktiv"
        
        vendor = await VendorRepository.get_by_id(vendor_id)
        settings = vendor.get("settings", {})
        
        # Calculate extra charges
        extra_charges = []
        
        # Late return fee
        if return_data.get("late_return_hours", 0) > 0:
            late_fee = return_data["late_return_hours"] * settings.get("late_return_fee_per_hour", 15)
            extra_charges.append({
                "description": f"Verspätete Rückgabe ({return_data['late_return_hours']}h)",
                "amount": late_fee,
                "charge_type": "late_return"
            })
        
        # Cleaning fee
        if return_data.get("cleaning_needed"):
            cleaning_fee = settings.get("cleaning_fee", 50)
            extra_charges.append({
                "description": "Reinigungsgebühr",
                "amount": cleaning_fee,
                "charge_type": "cleaning"
            })
        
        # Fuel difference
        if return_data.get("fuel_difference") and return_data["fuel_difference"] > 0:
            handover_fuel = booking.get("handover_record", {}).get("fuel_level", 100)
            fuel_diff = handover_fuel - return_data["fuel_level"]
            if fuel_diff > 0:
                # Assuming ~50L tank
                liters = fuel_diff / 100 * 50
                fuel_fee = liters * settings.get("fuel_fee_per_liter", 2.50)
                extra_charges.append({
                    "description": f"Tanknachfüllung ({fuel_diff}%)",
                    "amount": round(fuel_fee, 2),
                    "charge_type": "fuel"
                })
        
        return_record = {
            **return_data,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Calculate deposit return
        total_extra_charges = sum(c["amount"] for c in extra_charges)
        deposit_return = max(0, booking["deposit_amount"] - total_extra_charges)
        deposit_kept = booking["deposit_amount"] - deposit_return
        
        # Return deposit to customer (minus charges)
        if deposit_return > 0:
            await credit_wallet(
                user_id=booking["customer_id"],
                amount=deposit_return,
                tx_type=TransactionType.REFUND,
                description=f"Kaution Rückgabe: {booking['car_title']}",
                reference=booking_id,
            )
        
        await BookingRepository.update(booking_id, {
            "status": BookingStatus.COMPLETED.value,
            "return_record": return_record,
            "actual_end_time": datetime.now(timezone.utc).isoformat(),
            "extra_charges": extra_charges,
            "deposit_returned": deposit_return,
            "deposit_kept": deposit_kept,
        })
        
        # Update car status and mileage
        await CarRepository.update(booking["car_id"], {
            "status": CarStatus.AVAILABLE.value,
            "mileage": return_data["mileage"]
        })
        
        # Update vendor stats
        await VendorRepository.increment_stats(vendor_id, "total_bookings", 1)
        await VendorRepository.increment_stats(vendor_id, "total_revenue", booking["vendor_share"])
        
        # Update car stats
        await CarRepository.increment_stats(booking["car_id"], "total_bookings", 1)
        await CarRepository.increment_stats(booking["car_id"], "total_revenue", booking["total_amount"])
        await CarRepository.increment_stats(booking["car_id"], "total_days_rented", booking["rental_days"])
        
        return {
            "extra_charges": extra_charges,
            "total_extra_charges": total_extra_charges,
            "deposit_returned": deposit_return,
            "deposit_kept": deposit_kept,
        }, None
    
    @classmethod
    async def cancel_booking(cls, booking_id: str, user_id: str, is_vendor: bool = False) -> Tuple[bool, str]:
        """Cancel a booking (by customer or vendor)."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return False, "Buchung nicht gefunden"
        
        # Authorization check
        if is_vendor:
            if booking["vendor_id"] != user_id:
                # Check if user_id is vendor's user_id
                vendor = await VendorRepository.get_by_id(booking["vendor_id"])
                if not vendor or vendor["user_id"] != user_id:
                    return False, "Keine Berechtigung"
        else:
            if booking["customer_id"] != user_id:
                return False, "Keine Berechtigung"
        
        if booking["status"] in [BookingStatus.COMPLETED.value, BookingStatus.CANCELLED.value]:
            return False, "Buchung kann nicht storniert werden"
        
        vendor = await VendorRepository.get_by_id(booking["vendor_id"])
        settings = vendor.get("settings", {})
        
        # Calculate refund based on cancellation policy
        refund_amount = booking["total_amount"] + booking["deposit_amount"]
        
        if booking["payment_status"] == PaymentStatus.PAID.value:
            # Check cancellation deadline
            start = datetime.fromisoformat(booking["start_date"].replace("Z", "+00:00"))
            hours_until_start = (start - datetime.now(timezone.utc)).total_seconds() / 3600
            
            cancellation_fee = 0
            if hours_until_start < settings.get("cancellation_hours", 24):
                # Apply cancellation fee
                cancellation_fee = booking["total_amount"] * settings.get("cancellation_fee_percent", 20) / 100
                refund_amount -= cancellation_fee
            
            # Process refund
            await credit_wallet(
                user_id=booking["customer_id"],
                amount=refund_amount,
                tx_type=TransactionType.REFUND,
                description=f"Stornierung: {booking['car_title']}",
                reference=booking_id,
            )
            
            # Reverse vendor pending payout
            await VendorRepository.increment_stats(
                booking["vendor_id"], "pending_payout", -booking["vendor_share"]
            )
        
        await BookingRepository.update(booking_id, {
            "status": BookingStatus.CANCELLED.value,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": "vendor" if is_vendor else "customer",
            "payment_status": PaymentStatus.REFUNDED.value if booking["payment_status"] == PaymentStatus.PAID.value else booking["payment_status"],
        })
        
        # Update car status if it was reserved
        if booking["status"] in [BookingStatus.CONFIRMED.value, BookingStatus.READY_FOR_HANDOVER.value]:
            await CarRepository.update_status(booking["car_id"], CarStatus.AVAILABLE)
        
        return True, None


# ══════════════════════════════════════════════════════════════════════════════
# INVOICE SERVICE
# ══════════════════════════════════════════════════════════════════════════════

class InvoiceService:
    
    @classmethod
    async def generate_invoice(cls, booking_id: str, vendor_id: str, extra_data: dict = None) -> Tuple[dict, str]:
        """Generate invoice for a booking."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return None, "Buchung nicht gefunden"
        
        if booking["vendor_id"] != vendor_id:
            return None, "Keine Berechtigung"
        
        # Check if invoice already exists
        existing = await InvoiceRepository.get_by_booking(booking_id)
        if existing:
            return None, "Rechnung existiert bereits"
        
        vendor = await VendorRepository.get_by_id(vendor_id)
        customer = await db.users.find_one({"_id": ObjectId(booking["customer_id"])})
        
        # Build line items
        line_items = [
            {
                "description": f"Mietfahrzeug: {booking['car_title']} ({booking['rental_days']} Tage)",
                "quantity": booking["rental_days"],
                "unit_price": booking["base_price"] / booking["rental_days"],
                "total": booking["base_price"],
                "tax_rate": 19.0,
                "tax_amount": round(booking["base_price"] * 0.19, 2),
            }
        ]
        
        # Add extras
        if booking.get("extras_total", 0) > 0:
            line_items.append({
                "description": "Zusatzoptionen",
                "quantity": 1,
                "unit_price": booking["extras_total"],
                "total": booking["extras_total"],
                "tax_rate": 19.0,
                "tax_amount": round(booking["extras_total"] * 0.19, 2),
            })
        
        # Add extra charges from return
        for charge in booking.get("extra_charges", []):
            line_items.append({
                "description": charge["description"],
                "quantity": 1,
                "unit_price": charge["amount"],
                "total": charge["amount"],
                "tax_rate": 19.0,
                "tax_amount": round(charge["amount"] * 0.19, 2),
            })
        
        # Add deposit handling
        if extra_data and extra_data.get("include_deposit", True):
            if booking.get("deposit_kept", 0) > 0:
                line_items.append({
                    "description": "Einbehaltene Kaution",
                    "quantity": 1,
                    "unit_price": booking["deposit_kept"],
                    "total": booking["deposit_kept"],
                    "tax_rate": 19.0,
                    "tax_amount": round(booking["deposit_kept"] * 0.19, 2),
                })
        
        subtotal = sum(item["total"] for item in line_items)
        tax_total = sum(item["tax_amount"] for item in line_items)
        total = subtotal + tax_total
        
        # Apply discount if any
        discount = 0
        if extra_data and extra_data.get("discount_amount"):
            discount = extra_data["discount_amount"]
            total -= discount
        
        invoice_data = {
            "booking_id": booking_id,
            "vendor_id": vendor_id,
            "customer_id": booking["customer_id"],
            
            # Vendor info
            "vendor_company": vendor["company"],
            
            # Customer info
            "customer_name": customer.get("name", ""),
            "customer_email": customer.get("email", ""),
            "customer_address": customer.get("address", ""),
            
            # Booking info
            "car_title": booking["car_title"],
            "rental_period": f"{booking['start_date']} - {booking['end_date']}",
            
            # Line items
            "line_items": line_items,
            
            # Totals
            "subtotal": round(subtotal, 2),
            "tax_total": round(tax_total, 2),
            "discount": round(discount, 2),
            "discount_reason": extra_data.get("discount_reason") if extra_data else None,
            "total": round(total, 2),
            
            # Notes
            "notes": extra_data.get("notes") if extra_data else None,
            
            # Dates
            "issue_date": datetime.now(timezone.utc).isoformat(),
            "due_date": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        }
        
        invoice = await InvoiceRepository.create(invoice_data)
        return invoice, None
    
    @classmethod
    async def mark_invoice_paid(cls, invoice_id: str, vendor_id: str, paid_amount: float = None) -> Tuple[bool, str]:
        """Mark invoice as paid."""
        invoice = await InvoiceRepository.get_by_id(invoice_id)
        if not invoice:
            return False, "Rechnung nicht gefunden"
        
        if invoice["vendor_id"] != vendor_id:
            return False, "Keine Berechtigung"
        
        await InvoiceRepository.update(invoice_id, {
            "status": InvoiceStatus.PAID.value,
            "paid_amount": paid_amount or invoice["total"],
            "paid_at": datetime.now(timezone.utc).isoformat(),
        })
        
        return True, None


# ══════════════════════════════════════════════════════════════════════════════
# CONTRACT SERVICE
# ══════════════════════════════════════════════════════════════════════════════

class ContractService:
    
    @classmethod
    async def generate_contract(cls, booking_id: str, vendor_id: str, template_id: str = None) -> Tuple[dict, str]:
        """Generate rental contract for a booking."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return None, "Buchung nicht gefunden"
        
        if booking["vendor_id"] != vendor_id:
            return None, "Keine Berechtigung"
        
        # Check if contract already exists
        existing = await ContractRepository.get_by_booking(booking_id)
        if existing:
            return None, "Vertrag existiert bereits"
        
        vendor = await VendorRepository.get_by_id(vendor_id)
        customer = await db.users.find_one({"_id": ObjectId(booking["customer_id"])})
        car = await CarRepository.get_by_id(booking["car_id"])
        
        # Get template
        templates = await ContractRepository.get_templates(vendor_id)
        template = None
        if template_id:
            template = next((t for t in templates if t["template_id"] == template_id), None)
        if not template:
            template = next((t for t in templates if t.get("is_default")), None)
        
        # Contract data
        contract_data = {
            "booking_id": booking_id,
            "vendor_id": vendor_id,
            "customer_id": booking["customer_id"],
            "template_id": template["template_id"] if template else None,
            
            # Placeholders filled
            "customer_name": customer.get("name", ""),
            "customer_email": customer.get("email", ""),
            "customer_address": customer.get("address", ""),
            "customer_license": customer.get("license_number", ""),
            
            "vendor_name": vendor["company"]["company_name"],
            "vendor_address": vendor["company"]["address"],
            "vendor_city": vendor["company"]["city"],
            
            "vehicle_title": car["title"],
            "vehicle_brand": car["brand"],
            "vehicle_model": car["model"],
            "vehicle_registration": car["registration_number"],
            "vehicle_vin": car.get("vin", ""),
            
            "start_date": booking["start_date"],
            "end_date": booking["end_date"],
            "pickup_time": booking["pickup_time"],
            "return_time": booking["return_time"],
            
            "price_total": booking["total_amount"],
            "deposit": booking["deposit_amount"],
            "deductible": car.get("deductible", 1000),
            
            "mileage_out": car.get("mileage", 0),
            "fuel_out": 100,  # Will be updated at handover
            
            "terms": template.get("content", "") if template else "",
        }
        
        contract = await ContractRepository.create(contract_data)
        return contract, None
    
    @classmethod
    async def sign_contract(cls, contract_id: str, signer_type: str, signature: str) -> Tuple[bool, str]:
        """Sign contract (customer or vendor)."""
        contract = await ContractRepository.get_by_id(contract_id)
        if not contract:
            return False, "Vertrag nicht gefunden"
        
        update = {}
        if signer_type == "customer":
            update["signed_customer"] = True
            update["customer_signature"] = signature
        elif signer_type == "vendor":
            update["signed_vendor"] = True
            update["vendor_signature"] = signature
        
        # Check if fully signed
        will_be_signed = contract.get("signed_customer", False) or signer_type == "customer"
        will_be_vendor_signed = contract.get("signed_vendor", False) or signer_type == "vendor"
        
        if will_be_signed and will_be_vendor_signed:
            update["signed_at"] = datetime.now(timezone.utc).isoformat()
        
        await ContractRepository.update(contract_id, update)
        return True, None


# ══════════════════════════════════════════════════════════════════════════════
# PAYOUT SERVICE
# ══════════════════════════════════════════════════════════════════════════════

class PayoutService:
    
    @classmethod
    async def request_payout(cls, vendor_id: str, amount: float) -> Tuple[dict, str]:
        """Request vendor payout."""
        vendor = await VendorRepository.get_by_id(vendor_id)
        if not vendor:
            return None, "Vermieter nicht gefunden"
        
        if amount > vendor.get("pending_payout", 0):
            return None, "Nicht genügend Guthaben"
        
        if amount < 50:  # Minimum payout
            return None, "Mindestbetrag für Auszahlung: €50"
        
        payout = await PayoutRepository.create(vendor_id, amount, {
            "bank_name": vendor["company"].get("bank_name"),
            "iban": vendor["company"].get("iban"),
            "bic": vendor["company"].get("bic"),
        })
        
        # Reduce pending payout
        await VendorRepository.increment_stats(vendor_id, "pending_payout", -amount)
        
        return payout, None
    
    @classmethod
    async def process_payout(cls, payout_id: str, status: str, transaction_ref: str = None) -> Tuple[bool, str]:
        """Admin processes payout."""
        payout = await PayoutRepository.get_by_id(payout_id)
        if not payout:
            return False, "Auszahlung nicht gefunden"
        
        if payout["status"] != "pending":
            return False, "Auszahlung bereits verarbeitet"
        
        update = {"transaction_ref": transaction_ref}
        
        if status == "completed":
            update["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif status == "failed":
            # Return amount to vendor pending payout
            await VendorRepository.increment_stats(
                payout["vendor_id"], "pending_payout", payout["amount"]
            )
        
        await PayoutRepository.update_status(payout_id, status, update)
        return True, None
