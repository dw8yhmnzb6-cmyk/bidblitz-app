"""
BidBlitz V2 - Car Rental Repository
Database access layer for car rental collections.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from core.database import db, sanitize_doc
from .models import (
    VendorStatus, CarStatus, BookingStatus, PaymentStatus, InvoiceStatus,
    generate_vendor_id, generate_car_id, generate_booking_id, 
    generate_invoice_id, generate_contract_id, generate_damage_id, generate_payout_id
)


# ══════════════════════════════════════════════════════════════════════════════
# VENDOR REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class VendorRepository:
    collection = db.car_rental_vendors
    
    @classmethod
    async def create(cls, user_id: str, data: dict) -> dict:
        vendor_id = generate_vendor_id()
        now = datetime.now(timezone.utc).isoformat()
        
        vendor = {
            "vendor_id": vendor_id,
            "user_id": user_id,
            "status": VendorStatus.PENDING.value,
            "company": data,
            "settings": {
                "auto_approve_bookings": False,
                "min_booking_hours": 4,
                "max_booking_days": 30,
                "cancellation_hours": 24,
                "cancellation_fee_percent": 20.0,
                "late_return_fee_per_hour": 15.0,
                "cleaning_fee": 50.0,
                "fuel_fee_per_liter": 2.50,
                "require_deposit": True,
                "require_documents": True,
            },
            "commission_percent": 15.0,  # Default platform commission
            "total_revenue": 0.0,
            "pending_payout": 0.0,
            "total_bookings": 0,
            "total_cars": 0,
            "rating": 0.0,
            "review_count": 0,
            "verified": False,
            "featured": False,
            "created_at": now,
            "updated_at": now,
        }
        
        await cls.collection.insert_one(vendor)
        return sanitize_doc(vendor)
    
    @classmethod
    async def get_by_id(cls, vendor_id: str) -> Optional[dict]:
        vendor = await cls.collection.find_one({"vendor_id": vendor_id}, {"_id": 0})
        return sanitize_doc(vendor)
    
    @classmethod
    async def get_by_user_id(cls, user_id: str) -> Optional[dict]:
        vendor = await cls.collection.find_one({"user_id": user_id}, {"_id": 0})
        return sanitize_doc(vendor)
    
    @classmethod
    async def update(cls, vendor_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await cls.collection.update_one({"vendor_id": vendor_id}, {"$set": data})
        return await cls.get_by_id(vendor_id)
    
    @classmethod
    async def update_status(cls, vendor_id: str, status: VendorStatus, reason: str = None) -> bool:
        update = {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        if reason:
            update["status_reason"] = reason
        result = await cls.collection.update_one({"vendor_id": vendor_id}, {"$set": update})
        return result.modified_count > 0
    
    @classmethod
    async def list_all(cls, status: str = None, limit: int = 50, skip: int = 0) -> List[dict]:
        query = {}
        if status:
            query["status"] = status
        vendors = await cls.collection.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        return sanitize_doc(vendors)
    
    @classmethod
    async def increment_stats(cls, vendor_id: str, field: str, amount: float = 1) -> bool:
        result = await cls.collection.update_one(
            {"vendor_id": vendor_id},
            {"$inc": {field: amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0


# ══════════════════════════════════════════════════════════════════════════════
# CAR REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class CarRepository:
    collection = db.car_rental_cars
    images_collection = db.car_rental_car_images
    
    @classmethod
    async def create(cls, vendor_id: str, data: dict) -> dict:
        car_id = generate_car_id()
        now = datetime.now(timezone.utc).isoformat()
        
        car = {
            "car_id": car_id,
            "vendor_id": vendor_id,
            "status": CarStatus.AVAILABLE.value,
            **data,
            "main_image": None,
            "gallery_images": [],
            "extras": [],
            "total_bookings": 0,
            "total_revenue": 0.0,
            "total_days_rented": 0,
            "rating": 0.0,
            "review_count": 0,
            "created_at": now,
            "updated_at": now,
        }
        
        await cls.collection.insert_one(car)
        await VendorRepository.increment_stats(vendor_id, "total_cars", 1)
        return sanitize_doc(car)
    
    @classmethod
    async def get_by_id(cls, car_id: str) -> Optional[dict]:
        car = await cls.collection.find_one({"car_id": car_id}, {"_id": 0})
        return sanitize_doc(car)
    
    @classmethod
    async def update(cls, car_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await cls.collection.update_one({"car_id": car_id}, {"$set": data})
        return await cls.get_by_id(car_id)
    
    @classmethod
    async def update_status(cls, car_id: str, status: CarStatus) -> bool:
        result = await cls.collection.update_one(
            {"car_id": car_id},
            {"$set": {"status": status.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0
    
    @classmethod
    async def list_by_vendor(cls, vendor_id: str, status: str = None, limit: int = 100) -> List[dict]:
        query = {"vendor_id": vendor_id}
        if status:
            query["status"] = status
        cars = await cls.collection.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return sanitize_doc(cars)
    
    @classmethod
    async def search_public(cls, params: dict) -> tuple[List[dict], int]:
        """Search available cars for customers."""
        query = {"status": CarStatus.AVAILABLE.value}
        
        if params.get("city"):
            query["city"] = {"$regex": params["city"], "$options": "i"}
        if params.get("fuel_type"):
            query["fuel_type"] = params["fuel_type"]
        if params.get("gearbox"):
            query["gearbox"] = params["gearbox"]
        if params.get("min_seats"):
            query["seats"] = {"$gte": params["min_seats"]}
        if params.get("brand"):
            query["brand"] = {"$regex": params["brand"], "$options": "i"}
        if params.get("min_price"):
            query["price_per_day"] = {"$gte": params["min_price"]}
        if params.get("max_price"):
            if "price_per_day" in query:
                query["price_per_day"]["$lte"] = params["max_price"]
            else:
                query["price_per_day"] = {"$lte": params["max_price"]}
        
        # Check availability for date range
        if params.get("start_date") and params.get("end_date"):
            # Exclude cars with overlapping bookings
            booked_car_ids = await BookingRepository.get_booked_car_ids(
                params["start_date"], params["end_date"]
            )
            if booked_car_ids:
                query["car_id"] = {"$nin": booked_car_ids}
        
        # Sorting
        sort_field = "price_per_day"
        sort_order = 1
        if params.get("sort_by") == "newest":
            sort_field = "created_at"
            sort_order = -1
        elif params.get("sort_by") == "popular":
            sort_field = "total_bookings"
            sort_order = -1
        
        total = await cls.collection.count_documents(query)
        
        page = params.get("page", 1)
        limit = min(params.get("limit", 20), 50)
        skip = (page - 1) * limit
        
        cars = await cls.collection.find(query, {"_id": 0}).sort(sort_field, sort_order).skip(skip).limit(limit).to_list(limit)
        return sanitize_doc(cars), total
    
    @classmethod
    async def add_image(cls, car_id: str, image_url: str, is_main: bool = False) -> bool:
        if is_main:
            await cls.collection.update_one({"car_id": car_id}, {"$set": {"main_image": image_url}})
        else:
            await cls.collection.update_one({"car_id": car_id}, {"$push": {"gallery_images": image_url}})
        return True
    
    @classmethod
    async def add_extra(cls, car_id: str, extra: dict) -> bool:
        await cls.collection.update_one({"car_id": car_id}, {"$push": {"extras": extra}})
        return True
    
    @classmethod
    async def remove_extra(cls, car_id: str, extra_id: str) -> bool:
        await cls.collection.update_one({"car_id": car_id}, {"$pull": {"extras": {"extra_id": extra_id}}})
        return True
    
    @classmethod
    async def increment_stats(cls, car_id: str, field: str, amount: float = 1) -> bool:
        result = await cls.collection.update_one(
            {"car_id": car_id},
            {"$inc": {field: amount}}
        )
        return result.modified_count > 0


# ══════════════════════════════════════════════════════════════════════════════
# BOOKING REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class BookingRepository:
    collection = db.car_rental_bookings
    
    @classmethod
    async def create(cls, data: dict) -> dict:
        booking_id = generate_booking_id()
        now = datetime.now(timezone.utc).isoformat()
        
        booking = {
            "booking_id": booking_id,
            **data,
            "status": BookingStatus.PENDING.value,
            "payment_status": PaymentStatus.PENDING.value,
            "handover_record": None,
            "return_record": None,
            "extra_charges": [],
            "created_at": now,
            "updated_at": now,
        }
        
        await cls.collection.insert_one(booking)
        return sanitize_doc(booking)
    
    @classmethod
    async def get_by_id(cls, booking_id: str) -> Optional[dict]:
        booking = await cls.collection.find_one({"booking_id": booking_id}, {"_id": 0})
        return sanitize_doc(booking)
    
    @classmethod
    async def update(cls, booking_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await cls.collection.update_one({"booking_id": booking_id}, {"$set": data})
        return await cls.get_by_id(booking_id)
    
    @classmethod
    async def update_status(cls, booking_id: str, status: BookingStatus) -> bool:
        result = await cls.collection.update_one(
            {"booking_id": booking_id},
            {"$set": {"status": status.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0
    
    @classmethod
    async def list_by_vendor(cls, vendor_id: str, status: str = None, limit: int = 50, skip: int = 0) -> List[dict]:
        query = {"vendor_id": vendor_id}
        if status:
            query["status"] = status
        bookings = await cls.collection.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        return sanitize_doc(bookings)
    
    @classmethod
    async def list_by_customer(cls, customer_id: str, limit: int = 50) -> List[dict]:
        bookings = await cls.collection.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return sanitize_doc(bookings)
    
    @classmethod
    async def get_booked_car_ids(cls, start_date: str, end_date: str) -> List[str]:
        """Get car IDs that have bookings overlapping with the given date range."""
        bookings = await cls.collection.find(
            {
                "status": {"$in": [
                    BookingStatus.PENDING.value,
                    BookingStatus.CONFIRMED.value,
                    BookingStatus.READY_FOR_HANDOVER.value,
                    BookingStatus.ACTIVE.value
                ]},
                "$or": [
                    {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}},
                ]
            },
            {"car_id": 1}
        ).to_list(1000)
        return [b["car_id"] for b in bookings]
    
    @classmethod
    async def check_availability(cls, car_id: str, start_date: str, end_date: str, exclude_booking_id: str = None) -> bool:
        """Check if a car is available for the given date range."""
        query = {
            "car_id": car_id,
            "status": {"$in": [
                BookingStatus.PENDING.value,
                BookingStatus.CONFIRMED.value,
                BookingStatus.READY_FOR_HANDOVER.value,
                BookingStatus.ACTIVE.value
            ]},
            "$or": [
                {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}},
            ]
        }
        if exclude_booking_id:
            query["booking_id"] = {"$ne": exclude_booking_id}
        
        count = await cls.collection.count_documents(query)
        return count == 0
    
    @classmethod
    async def add_extra_charge(cls, booking_id: str, charge: dict) -> bool:
        await cls.collection.update_one(
            {"booking_id": booking_id},
            {"$push": {"extra_charges": charge}}
        )
        return True
    
    @classmethod
    async def get_vendor_stats(cls, vendor_id: str, days: int = 30) -> dict:
        """Get booking statistics for a vendor."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        
        pipeline = [
            {"$match": {"vendor_id": vendor_id, "created_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "revenue": {"$sum": "$total_amount"}
            }}
        ]
        
        results = await cls.collection.aggregate(pipeline).to_list(20)
        
        stats = {
            "total": 0,
            "pending": 0,
            "confirmed": 0,
            "active": 0,
            "completed": 0,
            "cancelled": 0,
            "revenue": 0.0
        }
        
        for r in results:
            stats["total"] += r["count"]
            stats[r["_id"]] = r["count"]
            if r["_id"] in ["completed", "active"]:
                stats["revenue"] += r.get("revenue", 0)
        
        return stats


# ══════════════════════════════════════════════════════════════════════════════
# INVOICE REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class InvoiceRepository:
    collection = db.car_rental_invoices
    
    @classmethod
    async def create(cls, data: dict) -> dict:
        invoice_id = generate_invoice_id()
        now = datetime.now(timezone.utc).isoformat()
        
        # Generate invoice number
        year = datetime.now().year
        count = await cls.collection.count_documents({"invoice_number": {"$regex": f"^{year}"}})
        invoice_number = f"{year}-{(count + 1):05d}"
        
        invoice = {
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            **data,
            "status": InvoiceStatus.DRAFT.value,
            "paid_amount": 0.0,
            "created_at": now,
            "updated_at": now,
        }
        
        await cls.collection.insert_one(invoice)
        return sanitize_doc(invoice)
    
    @classmethod
    async def get_by_id(cls, invoice_id: str) -> Optional[dict]:
        invoice = await cls.collection.find_one({"invoice_id": invoice_id}, {"_id": 0})
        return sanitize_doc(invoice)
    
    @classmethod
    async def get_by_booking(cls, booking_id: str) -> Optional[dict]:
        invoice = await cls.collection.find_one({"booking_id": booking_id}, {"_id": 0})
        return sanitize_doc(invoice)
    
    @classmethod
    async def update(cls, invoice_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await cls.collection.update_one({"invoice_id": invoice_id}, {"$set": data})
        return await cls.get_by_id(invoice_id)
    
    @classmethod
    async def list_by_vendor(cls, vendor_id: str, status: str = None, limit: int = 50) -> List[dict]:
        query = {"vendor_id": vendor_id}
        if status:
            query["status"] = status
        invoices = await cls.collection.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return sanitize_doc(invoices)
    
    @classmethod
    async def list_by_customer(cls, customer_id: str, limit: int = 50) -> List[dict]:
        invoices = await cls.collection.find({"customer_id": customer_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return sanitize_doc(invoices)


# ══════════════════════════════════════════════════════════════════════════════
# CONTRACT REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class ContractRepository:
    collection = db.car_rental_contracts
    templates_collection = db.car_rental_contract_templates
    
    @classmethod
    async def create(cls, data: dict) -> dict:
        contract_id = generate_contract_id()
        now = datetime.now(timezone.utc).isoformat()
        
        contract = {
            "contract_id": contract_id,
            **data,
            "signed_customer": False,
            "signed_vendor": False,
            "signed_at": None,
            "created_at": now,
            "updated_at": now,
        }
        
        await cls.collection.insert_one(contract)
        return sanitize_doc(contract)
    
    @classmethod
    async def get_by_id(cls, contract_id: str) -> Optional[dict]:
        contract = await cls.collection.find_one({"contract_id": contract_id}, {"_id": 0})
        return sanitize_doc(contract)
    
    @classmethod
    async def get_by_booking(cls, booking_id: str) -> Optional[dict]:
        contract = await cls.collection.find_one({"booking_id": booking_id}, {"_id": 0})
        return sanitize_doc(contract)
    
    @classmethod
    async def update(cls, contract_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await cls.collection.update_one({"contract_id": contract_id}, {"$set": data})
        return await cls.get_by_id(contract_id)
    
    @classmethod
    async def list_by_vendor(cls, vendor_id: str, limit: int = 50) -> List[dict]:
        contracts = await cls.collection.find({"vendor_id": vendor_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return sanitize_doc(contracts)
    
    @classmethod
    async def create_template(cls, vendor_id: str, data: dict) -> dict:
        template_id = f"TPL-{generate_contract_id()}"
        now = datetime.now(timezone.utc).isoformat()
        
        template = {
            "template_id": template_id,
            "vendor_id": vendor_id,
            **data,
            "created_at": now,
        }
        
        await cls.templates_collection.insert_one(template)
        return sanitize_doc(template)
    
    @classmethod
    async def get_templates(cls, vendor_id: str = None) -> List[dict]:
        query = {}
        if vendor_id:
            query["$or"] = [{"vendor_id": vendor_id}, {"vendor_id": None}]
        templates = await cls.templates_collection.find(query, {"_id": 0}).to_list(50)
        return sanitize_doc(templates)


# ══════════════════════════════════════════════════════════════════════════════
# DAMAGE REPORT REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class DamageRepository:
    collection = db.car_rental_damage_reports
    
    @classmethod
    async def create(cls, data: dict) -> dict:
        damage_id = generate_damage_id()
        now = datetime.now(timezone.utc).isoformat()
        
        damage = {
            "damage_id": damage_id,
            **data,
            "resolved": False,
            "created_at": now,
            "updated_at": now,
        }
        
        await cls.collection.insert_one(damage)
        return sanitize_doc(damage)
    
    @classmethod
    async def get_by_id(cls, damage_id: str) -> Optional[dict]:
        damage = await cls.collection.find_one({"damage_id": damage_id}, {"_id": 0})
        return sanitize_doc(damage)
    
    @classmethod
    async def update(cls, damage_id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await cls.collection.update_one({"damage_id": damage_id}, {"$set": data})
        return await cls.get_by_id(damage_id)
    
    @classmethod
    async def list_by_car(cls, car_id: str) -> List[dict]:
        damages = await cls.collection.find({"car_id": car_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return sanitize_doc(damages)
    
    @classmethod
    async def list_by_vendor(cls, vendor_id: str, resolved: bool = None) -> List[dict]:
        query = {"vendor_id": vendor_id}
        if resolved is not None:
            query["resolved"] = resolved
        damages = await cls.collection.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        return sanitize_doc(damages)


# ══════════════════════════════════════════════════════════════════════════════
# STAFF REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class StaffRepository:
    collection = db.car_rental_vendor_staff
    
    @classmethod
    async def create(cls, vendor_id: str, user_id: str, data: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        
        staff = {
            "vendor_id": vendor_id,
            "user_id": user_id,
            **data,
            "is_active": True,
            "created_at": now,
        }
        
        await cls.collection.insert_one(staff)
        return sanitize_doc(staff)
    
    @classmethod
    async def get_by_user_vendor(cls, user_id: str, vendor_id: str) -> Optional[dict]:
        staff = await cls.collection.find_one({"user_id": user_id, "vendor_id": vendor_id}, {"_id": 0})
        return sanitize_doc(staff)
    
    @classmethod
    async def list_by_vendor(cls, vendor_id: str) -> List[dict]:
        staff = await cls.collection.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(100)
        return sanitize_doc(staff)
    
    @classmethod
    async def update(cls, vendor_id: str, user_id: str, data: dict) -> bool:
        result = await cls.collection.update_one(
            {"vendor_id": vendor_id, "user_id": user_id},
            {"$set": data}
        )
        return result.modified_count > 0
    
    @classmethod
    async def delete(cls, vendor_id: str, user_id: str) -> bool:
        result = await cls.collection.delete_one({"vendor_id": vendor_id, "user_id": user_id})
        return result.deleted_count > 0


# ══════════════════════════════════════════════════════════════════════════════
# PAYOUT REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class PayoutRepository:
    collection = db.car_rental_payouts
    
    @classmethod
    async def create(cls, vendor_id: str, amount: float, data: dict = None) -> dict:
        payout_id = generate_payout_id()
        now = datetime.now(timezone.utc).isoformat()
        
        payout = {
            "payout_id": payout_id,
            "vendor_id": vendor_id,
            "amount": amount,
            "status": "pending",
            **(data or {}),
            "created_at": now,
        }
        
        await cls.collection.insert_one(payout)
        return sanitize_doc(payout)
    
    @classmethod
    async def get_by_id(cls, payout_id: str) -> Optional[dict]:
        payout = await cls.collection.find_one({"payout_id": payout_id}, {"_id": 0})
        return sanitize_doc(payout)
    
    @classmethod
    async def update_status(cls, payout_id: str, status: str, data: dict = None) -> bool:
        update = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
        if data:
            update.update(data)
        result = await cls.collection.update_one({"payout_id": payout_id}, {"$set": update})
        return result.modified_count > 0
    
    @classmethod
    async def list_by_vendor(cls, vendor_id: str, status: str = None) -> List[dict]:
        query = {"vendor_id": vendor_id}
        if status:
            query["status"] = status
        payouts = await cls.collection.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        return sanitize_doc(payouts)


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER DOCUMENTS REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class CustomerDocumentRepository:
    collection = db.car_rental_customer_documents
    
    @classmethod
    async def create(cls, customer_id: str, data: dict) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        
        doc = {
            "customer_id": customer_id,
            **data,
            "verified": False,
            "uploaded_at": now,
        }
        
        await cls.collection.insert_one(doc)
        return sanitize_doc(doc)
    
    @classmethod
    async def get_by_customer(cls, customer_id: str) -> List[dict]:
        docs = await cls.collection.find({"customer_id": customer_id}, {"_id": 0}).to_list(20)
        return sanitize_doc(docs)
    
    @classmethod
    async def verify(cls, customer_id: str, doc_type: str, verified_by: str) -> bool:
        result = await cls.collection.update_one(
            {"customer_id": customer_id, "doc_type": doc_type},
            {"$set": {"verified": True, "verified_by": verified_by, "verified_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0


# ══════════════════════════════════════════════════════════════════════════════
# ACTIVITY LOG REPOSITORY
# ══════════════════════════════════════════════════════════════════════════════

class ActivityLogRepository:
    collection = db.car_rental_activity_logs
    
    @classmethod
    async def log(cls, vendor_id: str, user_id: str, action: str, entity_type: str, entity_id: str, details: dict = None):
        await cls.collection.insert_one({
            "vendor_id": vendor_id,
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    @classmethod
    async def list_by_vendor(cls, vendor_id: str, limit: int = 100) -> List[dict]:
        logs = await cls.collection.find({"vendor_id": vendor_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return sanitize_doc(logs)
