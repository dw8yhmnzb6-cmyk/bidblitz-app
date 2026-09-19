"""
BidBlitz V2 - Car Rental Services
Business logic layer for car rental operations.
"""

from typing import Optional, List, Dict, Any, Tuple
import hashlib
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

def _car_rental_day_keys(car_id: str, start_date: str, end_date: str) -> List[str]:
    try:
        start = datetime.fromisoformat(str(start_date).replace("Z", "+00:00")).date()
        end = datetime.fromisoformat(str(end_date).replace("Z", "+00:00")).date()
    except Exception:
        raise ValueError("Ungültiger Mietzeitraum")
    if end < start:
        raise ValueError("Enddatum liegt vor Startdatum")
    keys = []
    day = start
    while day <= end:
        digest = hashlib.sha256(f"{car_id}:{day.isoformat()}".encode("utf-8")).hexdigest()[:24]
        keys.append(f"CRD-{digest}")
        day += timedelta(days=1)
    return keys


async def _claim_car_rental_days(booking: dict) -> bool:
    booking_id = booking["booking_id"]
    keys = _car_rental_day_keys(booking["car_id"], booking["start_date"], booking["end_date"])
    claimed = []
    try:
        for key in keys:
            try:
                await db.car_rental_day_claims.insert_one({
                    "_id": key,
                    "car_id": booking["car_id"],
                    "booking_id": booking_id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                claimed.append(key)
            except Exception:
                existing = await db.car_rental_day_claims.find_one({"_id": key}, {"_id": 0, "booking_id": 1})
                if not existing or existing.get("booking_id") != booking_id:
                    return False
        return True
    finally:
        if len(claimed) < len(keys):
            conflict = False
            for key in keys:
                existing = await db.car_rental_day_claims.find_one({"_id": key}, {"_id": 0, "booking_id": 1})
                if existing and existing.get("booking_id") != booking_id:
                    conflict = True
                    break
            if conflict and claimed:
                await db.car_rental_day_claims.delete_many({
                    "_id": {"$in": claimed},
                    "booking_id": booking_id,
                })


async def _release_car_rental_days(booking_id: str) -> None:
    await db.car_rental_day_claims.delete_many({"booking_id": booking_id})


def _car_payout_marker(booking_id: str) -> str:
    return hashlib.sha256(f"car-rental-payout:{booking_id}".encode("utf-8")).hexdigest()[:24]


async def _ensure_vendor_pending_payout(booking: dict) -> bool:
    marker = _car_payout_marker(booking["booking_id"])
    marker_field = f"pending_payout_markers.{marker}"
    result = await db.car_rental_vendors.update_one(
        {
            "vendor_id": booking["vendor_id"],
            marker_field: {"$exists": False},
        },
        {
            "$inc": {"pending_payout": round(float(booking["vendor_share"]), 2)},
            "$set": {
                marker_field: {
                    "booking_id": booking["booking_id"],
                    "amount": round(float(booking["vendor_share"]), 2),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    if result.modified_count == 1:
        return True
    vendor = await db.car_rental_vendors.find_one(
        {"vendor_id": booking["vendor_id"], marker_field: {"$exists": True}},
        {"_id": 1},
    )
    return bool(vendor)


async def _reverse_vendor_pending_payout_once(booking: dict) -> bool:
    marker = _car_payout_marker(booking["booking_id"])
    marker_field = f"pending_payout_markers.{marker}"
    reversal_field = f"pending_payout_reversal_markers.{marker}"
    amount = round(float(booking["vendor_share"]), 2)
    result = await db.car_rental_vendors.update_one(
        {
            "vendor_id": booking["vendor_id"],
            marker_field: {"$exists": True},
            reversal_field: {"$exists": False},
            "pending_payout": {"$gte": amount},
        },
        {
            "$inc": {"pending_payout": -amount},
            "$set": {
                reversal_field: {
                    "booking_id": booking["booking_id"],
                    "amount": amount,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    if result.modified_count == 1:
        return True
    vendor = await db.car_rental_vendors.find_one(
        {"vendor_id": booking["vendor_id"], reversal_field: {"$exists": True}},
        {"_id": 1},
    )
    return bool(vendor)


async def _ensure_vendor_deposit_keep(booking: dict, amount: float) -> bool:
    amount = round(max(0.0, float(amount or 0)), 2)
    if amount <= 0:
        return True
    marker = hashlib.sha256(f"car-rental-deposit:{booking['booking_id']}".encode("utf-8")).hexdigest()[:24]
    marker_field = f"deposit_keep_markers.{marker}"
    result = await db.car_rental_vendors.update_one(
        {"vendor_id": booking["vendor_id"], marker_field: {"$exists": False}},
        {
            "$inc": {"pending_payout": amount},
            "$set": {
                marker_field: {
                    "booking_id": booking["booking_id"],
                    "amount": amount,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    if result.modified_count == 1:
        return True
    vendor = await db.car_rental_vendors.find_one(
        {"vendor_id": booking["vendor_id"], marker_field: {"$exists": True}},
        {"_id": 1},
    )
    return bool(vendor)


class BookingService:
    
    @classmethod
    async def create_booking(cls, customer_id: str, data: dict) -> Tuple[dict, str]:
        """Create an idempotent unpaid booking quote. Availability is claimed at payment."""
        idempotency_key = str(data.get("idempotency_key") or "").strip()
        if len(idempotency_key) < 8:
            return None, "Idempotency-Key erforderlich"
        key_hash = hashlib.sha256(f"{customer_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
        booking_id = f"BK-{key_hash.upper()}"

        existing = await BookingRepository.get_by_id(booking_id)
        if existing:
            expected = (data["car_id"], data["start_date"], data["end_date"])
            actual = (existing.get("car_id"), existing.get("start_date"), existing.get("end_date"))
            if actual != expected:
                return None, "Idempotency-Key wurde bereits für eine andere Buchung verwendet"
            return existing, None

        customer = await db.users.find_one({"_id": ObjectId(customer_id)})
        if not customer:
            return None, "Kunde nicht gefunden"
        if customer.get("role") != "admin" and customer.get("kyc_status") != "approved":
            return None, "KYC-Verifizierung erforderlich"

        car = await CarRepository.get_by_id(data["car_id"])
        if not car:
            return None, "Fahrzeug nicht gefunden"
        if car["status"] in {
            CarStatus.RENTED.value,
            CarStatus.MAINTENANCE.value,
            CarStatus.BLOCKED.value,
            CarStatus.ARCHIVED.value,
        }:
            return None, "Fahrzeug nicht verfügbar"

        vendor = await VendorRepository.get_by_id(car["vendor_id"])
        if not vendor or vendor["status"] != VendorStatus.APPROVED.value:
            return None, "Vermieter nicht verfügbar"

        is_available = await BookingRepository.check_availability(
            data["car_id"], data["start_date"], data["end_date"]
        )
        if not is_available:
            return None, "Fahrzeug ist in diesem Zeitraum nicht verfügbar"

        pricing = await CarService.calculate_rental_price(
            data["car_id"], data["start_date"], data["end_date"], data.get("extras", [])
        )
        if not pricing:
            return None, "Preisberechnung fehlgeschlagen"

        commission_pct = float(vendor.get("commission_percent", 15.0) or 0)
        if not 0 <= commission_pct <= 50:
            return None, "Ungültige Vermieterprovision"

        booking_data = {
            "booking_id": booking_id,
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
            "idempotency_key": idempotency_key,
            "car_title": car["title"],
            "car_brand": car["brand"],
            "car_model": car["model"],
            "car_registration": car["registration_number"],
            "rental_days": pricing["days"],
            "base_price": pricing["base_price"],
            "extras_total": pricing["extras_total"],
            "subtotal": pricing["subtotal"],
            "tax_amount": pricing["tax_amount"],
            "total_amount": pricing["total"],
            "deposit_amount": pricing["deposit"],
            "commission_percent": commission_pct,
            "commission_amount": round(pricing["total"] * commission_pct / 100, 2),
            "vendor_share": round(pricing["total"] * (100 - commission_pct) / 100, 2),
        }

        booking = await BookingRepository.create(booking_data)
        await ActivityLogRepository.log(
            car["vendor_id"], customer_id, "create", "booking", booking["booking_id"],
            {"car_id": data["car_id"], "total": pricing["total"]}
        )
        return booking, None

    @classmethod
    async def process_booking_payment(cls, booking_id: str, customer_id: str) -> Tuple[bool, str]:
        """Pay exactly once and atomically claim the vehicle rental dates."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return False, "Buchung nicht gefunden"
        if booking["customer_id"] != customer_id:
            return False, "Keine Berechtigung"
        if booking.get("status") in {BookingStatus.CANCELLED.value, BookingStatus.REJECTED.value}:
            return False, "Buchung wurde bereits beendet"

        if booking.get("payment_status") == PaymentStatus.PAID.value:
            await _ensure_vendor_pending_payout(booking)
            return True, None

        if not await _claim_car_rental_days(booking):
            return False, "Fahrzeug ist in diesem Zeitraum inzwischen nicht mehr verfügbar"

        await db.car_rental_bookings.update_one(
            {
                "booking_id": booking_id,
                "customer_id": customer_id,
                "payment_status": {"$in": [PaymentStatus.PENDING.value, PaymentStatus.FAILED.value, "processing"]},
            },
            {"$set": {
                "payment_status": "processing",
                "payment_started_at": datetime.now(timezone.utc).isoformat(),
            }},
        )

        total_with_deposit = round(float(booking["total_amount"]) + float(booking["deposit_amount"]), 2)
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
            },
            idempotency_key=f"car-rental:payment:{booking_id}",
        )

        if not result.success:
            if result.status.value in {"pending", "reconciliation_required"}:
                await db.car_rental_bookings.update_one(
                    {"booking_id": booking_id},
                    {"$set": {
                        "payment_status": "processing" if result.status.value == "pending" else "reconciliation_required",
                        "payment_error": result.error,
                    }},
                )
                return False, result.error or "Zahlung wird noch verarbeitet"
            await db.car_rental_bookings.update_one(
                {"booking_id": booking_id},
                {"$set": {"payment_status": PaymentStatus.FAILED.value, "payment_error": result.error}},
            )
            await _release_car_rental_days(booking_id)
            return False, result.error or "Zahlung fehlgeschlagen"

        await db.car_rental_bookings.update_one(
            {"booking_id": booking_id, "customer_id": customer_id},
            {"$set": {
                "payment_status": PaymentStatus.PAID.value,
                "paid_at": datetime.now(timezone.utc).isoformat(),
                "payment_transaction_id": result.transaction_id,
            }},
        )

        paid_booking = await BookingRepository.get_by_id(booking_id) or booking
        if not await _ensure_vendor_pending_payout(paid_booking):
            return False, "Vermieter-Guthaben benötigt Abstimmung"

        vendor = await VendorRepository.get_by_id(booking["vendor_id"])
        if vendor and vendor.get("settings", {}).get("auto_approve_bookings"):
            await db.car_rental_bookings.update_one(
                {"booking_id": booking_id, "status": BookingStatus.PENDING.value},
                {"$set": {
                    "status": BookingStatus.CONFIRMED.value,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )

        try:
            from routes.loyalty_system import process_loyalty_rewards
            await process_loyalty_rewards(
                user_id=customer_id,
                source_type="car_rental",
                source_id=booking_id,
                amount=booking["total_amount"],
                tx_id=result.transaction_id or booking_id,
            )
        except Exception:
            pass

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
        
        # Date claims on the paid booking protect the rental period.
        # Keep fleet availability independent from unrelated future dates.
        return True, None
    
    @classmethod
    async def reject_booking(cls, booking_id: str, vendor_id: str, reason: str = None) -> Tuple[bool, str]:
        """Vendor rejection with exactly-once refund and payout reversal."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return False, "Buchung nicht gefunden"
        if booking["vendor_id"] != vendor_id:
            return False, "Keine Berechtigung"

        if booking.get("status") == BookingStatus.REJECTED.value:
            return True, None
        if booking.get("status") not in [BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value]:
            return False, "Buchung kann nicht abgelehnt werden"

        was_paid = booking.get("payment_status") == PaymentStatus.PAID.value
        if was_paid:
            refund_amount = round(float(booking["total_amount"]) + float(booking["deposit_amount"]), 2)
            refund = await credit_wallet(
                user_id=booking["customer_id"],
                amount=refund_amount,
                tx_type=TransactionType.REFUND,
                description=f"Rückerstattung: {booking['car_title']}",
                reference=f"{booking_id}-REJECT",
                source="car_rental_reject",
                metadata={"booking_id": booking_id, "vendor_id": vendor_id},
                idempotency_key=f"car-rental:reject-refund:{booking_id}",
            )
            if not refund.success:
                return False, refund.error or "Rückerstattung fehlgeschlagen"
            if not await _reverse_vendor_pending_payout_once(booking):
                return False, "Vermieter-Guthaben benötigt Abstimmung"

        result = await db.car_rental_bookings.update_one(
            {
                "booking_id": booking_id,
                "status": {"$in": [BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value]},
            },
            {"$set": {
                "status": BookingStatus.REJECTED.value,
                "rejection_reason": reason,
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "payment_status": PaymentStatus.REFUNDED.value if was_paid else booking.get("payment_status"),
                "refund_status": "completed" if was_paid else None,
            }},
        )
        if result.modified_count != 1:
            fresh = await BookingRepository.get_by_id(booking_id)
            if not fresh or fresh.get("status") != BookingStatus.REJECTED.value:
                return False, "Buchungsstatus wurde parallel geändert"

        await _release_car_rental_days(booking_id)
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
        """Complete a return exactly once and settle the deposit safely."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return None, "Buchung nicht gefunden"
        if booking["vendor_id"] != vendor_id:
            return None, "Keine Berechtigung"
        if booking.get("status") == BookingStatus.COMPLETED.value:
            return {
                "extra_charges": booking.get("extra_charges", []),
                "total_extra_charges": booking.get("total_extra_charges", 0),
                "deposit_returned": booking.get("deposit_returned", 0),
                "deposit_kept": booking.get("deposit_kept", 0),
                "uncovered_extra_charges": booking.get("uncovered_extra_charges", 0),
                "replayed": True,
            }, None
        if booking["status"] != BookingStatus.ACTIVE.value:
            return None, "Buchung ist nicht aktiv"

        vendor = await VendorRepository.get_by_id(vendor_id)
        if not vendor:
            return None, "Vermieter nicht gefunden"
        settings = vendor.get("settings", {})

        extra_charges = []
        late_hours = max(0.0, float(return_data.get("late_return_hours") or 0))
        if late_hours > 0:
            late_fee_rate = max(0.0, float(settings.get("late_return_fee_per_hour", 15) or 0))
            extra_charges.append({
                "description": f"Verspätete Rückgabe ({late_hours:g}h)",
                "amount": round(late_hours * late_fee_rate, 2),
                "charge_type": "late_return",
            })

        if return_data.get("cleaning_needed"):
            cleaning_fee = max(0.0, float(settings.get("cleaning_fee", 50) or 0))
            if cleaning_fee > 0:
                extra_charges.append({
                    "description": "Reinigungsgebühr",
                    "amount": round(cleaning_fee, 2),
                    "charge_type": "cleaning",
                })

        handover_fuel = float((booking.get("handover_record") or {}).get("fuel_level", 100) or 0)
        return_fuel = float(return_data.get("fuel_level") or 0)
        fuel_diff = max(0.0, handover_fuel - return_fuel)
        if fuel_diff > 0:
            liters = fuel_diff / 100.0 * 50.0
            fuel_rate = max(0.0, float(settings.get("fuel_fee_per_liter", 2.50) or 0))
            fuel_fee = round(liters * fuel_rate, 2)
            if fuel_fee > 0:
                extra_charges.append({
                    "description": f"Tanknachfüllung ({fuel_diff:g}%)",
                    "amount": fuel_fee,
                    "charge_type": "fuel",
                })

        total_extra_charges = round(sum(max(0.0, float(item["amount"])) for item in extra_charges), 2)
        deposit_amount = round(max(0.0, float(booking.get("deposit_amount") or 0)), 2)
        deposit_kept = round(min(deposit_amount, total_extra_charges), 2)
        deposit_return = round(max(0.0, deposit_amount - deposit_kept), 2)
        uncovered_extra = round(max(0.0, total_extra_charges - deposit_amount), 2)

        refund = None
        if deposit_return > 0:
            refund = await credit_wallet(
                user_id=booking["customer_id"],
                amount=deposit_return,
                tx_type=TransactionType.REFUND,
                description=f"Kaution Rückgabe: {booking['car_title']}",
                reference=f"{booking_id}-DEPOSIT",
                source="car_rental_deposit_return",
                metadata={"booking_id": booking_id, "vendor_id": vendor_id},
                idempotency_key=f"car-rental:deposit-refund:{booking_id}",
            )
            if not refund.success:
                return None, refund.error or "Kautionsrückzahlung fehlgeschlagen"

        if deposit_kept > 0 and not await _ensure_vendor_deposit_keep(booking, deposit_kept):
            return None, "Einbehaltene Kaution benötigt Abstimmung"

        return_record = {
            **return_data,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        transition = await db.car_rental_bookings.update_one(
            {"booking_id": booking_id, "vendor_id": vendor_id, "status": BookingStatus.ACTIVE.value},
            {"$set": {
                "status": BookingStatus.COMPLETED.value,
                "return_record": return_record,
                "actual_end_time": datetime.now(timezone.utc).isoformat(),
                "extra_charges": extra_charges,
                "total_extra_charges": total_extra_charges,
                "deposit_returned": deposit_return,
                "deposit_kept": deposit_kept,
                "uncovered_extra_charges": uncovered_extra,
                "deposit_refund_transaction_id": refund.transaction_id if refund else None,
            }},
        )
        if transition.modified_count != 1:
            fresh = await BookingRepository.get_by_id(booking_id)
            if fresh and fresh.get("status") == BookingStatus.COMPLETED.value:
                return {
                    "extra_charges": fresh.get("extra_charges", []),
                    "total_extra_charges": fresh.get("total_extra_charges", 0),
                    "deposit_returned": fresh.get("deposit_returned", 0),
                    "deposit_kept": fresh.get("deposit_kept", 0),
                    "uncovered_extra_charges": fresh.get("uncovered_extra_charges", 0),
                    "replayed": True,
                }, None
            return None, "Rückgabe wurde parallel geändert"

        await CarRepository.update(booking["car_id"], {
            "status": CarStatus.AVAILABLE.value,
            "mileage": return_data["mileage"],
        })
        await _release_car_rental_days(booking_id)

        await VendorRepository.increment_stats(vendor_id, "total_bookings", 1)
        await VendorRepository.increment_stats(vendor_id, "total_revenue", booking["vendor_share"])
        await CarRepository.increment_stats(booking["car_id"], "total_bookings", 1)
        await CarRepository.increment_stats(booking["car_id"], "total_revenue", booking["total_amount"])
        await CarRepository.increment_stats(booking["car_id"], "total_days_rented", booking["rental_days"])

        return {
            "extra_charges": extra_charges,
            "total_extra_charges": total_extra_charges,
            "deposit_returned": deposit_return,
            "deposit_kept": deposit_kept,
            "uncovered_extra_charges": uncovered_extra,
            "replayed": bool(refund.idempotent_replay) if refund else False,
        }, None

    @classmethod
    async def cancel_booking(cls, booking_id: str, user_id: str, is_vendor: bool = False) -> Tuple[bool, str]:
        """Cancel a non-active booking with exactly-once refund."""
        booking = await BookingRepository.get_by_id(booking_id)
        if not booking:
            return False, "Buchung nicht gefunden"

        if is_vendor:
            if booking["vendor_id"] != user_id:
                vendor = await VendorRepository.get_by_id(booking["vendor_id"])
                if not vendor or vendor["user_id"] != user_id:
                    return False, "Keine Berechtigung"
        elif booking["customer_id"] != user_id:
            return False, "Keine Berechtigung"

        if booking.get("status") == BookingStatus.CANCELLED.value:
            return True, None
        if booking.get("status") == BookingStatus.ACTIVE.value:
            return False, "Aktive Miete kann nicht normal storniert werden. Bitte Rückgabe/Support verwenden."
        if booking.get("status") in {BookingStatus.COMPLETED.value, BookingStatus.REJECTED.value}:
            return False, "Buchung kann nicht storniert werden"

        vendor = await VendorRepository.get_by_id(booking["vendor_id"])
        if not vendor:
            return False, "Vermieter nicht gefunden"
        settings = vendor.get("settings", {})
        was_paid = booking.get("payment_status") == PaymentStatus.PAID.value
        refund_amount = round(float(booking["total_amount"]) + float(booking["deposit_amount"]), 2)
        cancellation_fee = 0.0

        if was_paid:
            start = datetime.fromisoformat(str(booking["start_date"]).replace("Z", "+00:00"))
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            hours_until_start = (start - datetime.now(timezone.utc)).total_seconds() / 3600
            cancellation_hours = max(0.0, float(settings.get("cancellation_hours", 24) or 0))
            cancellation_pct = min(100.0, max(0.0, float(settings.get("cancellation_fee_percent", 20) or 0)))
            if hours_until_start < cancellation_hours:
                cancellation_fee = round(float(booking["total_amount"]) * cancellation_pct / 100.0, 2)
                refund_amount = round(max(0.0, refund_amount - cancellation_fee), 2)

            refund = await credit_wallet(
                user_id=booking["customer_id"],
                amount=refund_amount,
                tx_type=TransactionType.REFUND,
                description=f"Stornierung: {booking['car_title']}",
                reference=f"{booking_id}-CANCEL",
                source="car_rental_cancellation",
                metadata={
                    "booking_id": booking_id,
                    "vendor_id": booking["vendor_id"],
                    "cancellation_fee": cancellation_fee,
                },
                idempotency_key=f"car-rental:cancel-refund:{booking_id}",
            )
            if not refund.success:
                return False, refund.error or "Rückerstattung fehlgeschlagen"

            if not await _reverse_vendor_pending_payout_once(booking):
                return False, "Vermieter-Guthaben benötigt Abstimmung"

        transition = await db.car_rental_bookings.update_one(
            {
                "booking_id": booking_id,
                "status": {"$nin": [BookingStatus.ACTIVE.value, BookingStatus.COMPLETED.value, BookingStatus.CANCELLED.value]},
            },
            {"$set": {
                "status": BookingStatus.CANCELLED.value,
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "cancelled_by": "vendor" if is_vendor else "customer",
                "payment_status": PaymentStatus.REFUNDED.value if was_paid else booking.get("payment_status"),
                "refund_amount": refund_amount if was_paid else 0.0,
                "cancellation_fee": cancellation_fee,
            }},
        )
        if transition.modified_count != 1:
            fresh = await BookingRepository.get_by_id(booking_id)
            if not fresh or fresh.get("status") != BookingStatus.CANCELLED.value:
                return False, "Buchungsstatus wurde parallel geändert"

        await _release_car_rental_days(booking_id)
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
    async def request_payout(cls, vendor_id: str, amount: float, idempotency_key: str) -> Tuple[dict, str]:
        """Reserve pending vendor earnings exactly once and create a deterministic payout."""
        amount = round(float(amount or 0), 2)
        key = str(idempotency_key or "").strip()
        if len(key) < 8:
            return None, "Idempotency-Key erforderlich"
        if amount < 50:
            return None, "Mindestbetrag für Auszahlung: €50"

        key_hash = hashlib.sha256(f"{vendor_id}:{key}".encode("utf-8")).hexdigest()[:20]
        payout_id = f"PO-{key_hash.upper()}"
        existing = await PayoutRepository.get_by_id(payout_id)
        if existing:
            if round(float(existing.get("amount") or 0), 2) != amount or existing.get("vendor_id") != vendor_id:
                return None, "Idempotency-Key wurde bereits für eine andere Auszahlung verwendet"
            return existing, None

        vendor = await VendorRepository.get_by_id(vendor_id)
        if not vendor:
            return None, "Vermieter nicht gefunden"
        if vendor.get("status") != VendorStatus.APPROVED.value:
            return None, "Vermieter ist nicht freigeschaltet"
        company = vendor.get("company") or {}
        if not company.get("iban"):
            return None, "IBAN nicht hinterlegt"

        reserve_marker = f"payout_reservations.{key_hash}"
        reserve = await db.car_rental_vendors.update_one(
            {
                "vendor_id": vendor_id,
                "status": VendorStatus.APPROVED.value,
                "pending_payout": {"$gte": amount},
                reserve_marker: {"$exists": False},
            },
            {
                "$inc": {"pending_payout": -amount},
                "$set": {
                    "last_payout_request_at": datetime.now(timezone.utc).isoformat(),
                    reserve_marker: {
                        "payout_id": payout_id,
                        "amount": amount,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                },
            },
        )
        if reserve.modified_count != 1:
            existing = await PayoutRepository.get_by_id(payout_id)
            if existing:
                return existing, None
            vendor_now = await db.car_rental_vendors.find_one(
                {"vendor_id": vendor_id, reserve_marker: {"$exists": True}},
                {"_id": 0, reserve_marker: 1},
            )
            if vendor_now:
                return None, "Auszahlungsanforderung wird bereits verarbeitet"
            return None, "Nicht genügend verfügbares Guthaben"

        try:
            payout = await PayoutRepository.create(vendor_id, amount, {
                "payout_id": payout_id,
                "bank_name": company.get("bank_name"),
                "iban": company.get("iban"),
                "bic": company.get("bic"),
                "reserved_from_pending_payout": True,
                "idempotency_key_hash": key_hash,
            })
        except Exception:
            await db.car_rental_vendors.update_one(
                {"vendor_id": vendor_id, reserve_marker: {"$exists": True}},
                {
                    "$inc": {"pending_payout": amount},
                    "$unset": {reserve_marker: ""},
                },
            )
            raise

        return payout, None
    
    @classmethod
    async def process_payout(cls, payout_id: str, status: str, transaction_ref: str = None) -> Tuple[bool, str]:
        """Move payout through a CAS state machine; failed payouts restore funds once."""
        if status not in {"processing", "completed", "failed"}:
            return False, "Ungültiger Auszahlungsstatus"

        payout = await PayoutRepository.get_by_id(payout_id)
        if not payout:
            return False, "Auszahlung nicht gefunden"

        current = str(payout.get("status") or "pending")
        if current == status:
            return True, None
        if current in {"completed", "failed"}:
            return False, "Auszahlung bereits verarbeitet"

        now = datetime.now(timezone.utc).isoformat()
        if status == "processing":
            result = await db.car_rental_payouts.update_one(
                {"payout_id": payout_id, "status": "pending"},
                {"$set": {"status": "processing", "updated_at": now}},
            )
            if result.modified_count != 1:
                fresh = await PayoutRepository.get_by_id(payout_id)
                return (True, None) if fresh and fresh.get("status") == "processing" else (False, "Auszahlung wurde parallel geändert")
            return True, None

        if status == "completed":
            transaction_ref = str(transaction_ref or "").strip()
            if len(transaction_ref) < 4:
                return False, "Externe Auszahlungsreferenz erforderlich"
            result = await db.car_rental_payouts.update_one(
                {"payout_id": payout_id, "status": {"$in": ["pending", "processing"]}},
                {"$set": {
                    "status": "completed",
                    "transaction_ref": transaction_ref,
                    "completed_at": now,
                    "updated_at": now,
                }},
            )
            if result.modified_count != 1:
                fresh = await PayoutRepository.get_by_id(payout_id)
                return (True, None) if fresh and fresh.get("status") == "completed" else (False, "Auszahlung wurde parallel geändert")
            return True, None

        # failed
        result = await db.car_rental_payouts.update_one(
            {"payout_id": payout_id, "status": {"$in": ["pending", "processing"]}},
            {"$set": {"status": "failed", "failed_at": now, "updated_at": now}},
        )
        if result.modified_count != 1:
            fresh = await PayoutRepository.get_by_id(payout_id)
            return (True, None) if fresh and fresh.get("status") == "failed" else (False, "Auszahlung wurde parallel geändert")

        if payout.get("reserved_from_pending_payout", True):
            await db.car_rental_vendors.update_one(
                {"vendor_id": payout["vendor_id"]},
                {"$inc": {"pending_payout": round(float(payout["amount"]), 2)}},
            )
        return True, None
