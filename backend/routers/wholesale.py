"""Wholesale/Großkunden router - B2B customer management"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user
from utils.email import send_wholesale_welcome_email

router = APIRouter(tags=["Wholesale"])

# ==================== SCHEMAS ====================

class WholesaleApplication(BaseModel):
    company_name: str
    contact_name: str
    email: str
    phone: str
    website: Optional[str] = None
    expected_volume: str  # e.g., "100-500", "500-1000", "1000-5000", "5000+"
    business_type: Optional[str] = "small"  # "small" for Kleinhändler, "wholesale" for Großhändler
    message: Optional[str] = None

class WholesaleUpdate(BaseModel):
    status: Optional[str] = None  # pending, approved, rejected
    discount_percent: Optional[float] = None
    credit_limit: Optional[float] = None
    payment_terms: Optional[str] = None  # prepaid, net15, net30
    notes: Optional[str] = None

# ==================== PUBLIC ENDPOINTS ====================

@router.post("/wholesale/apply")
async def apply_wholesale(application: WholesaleApplication):
    """Submit application to become a wholesale customer"""
    # Check if email already has an application
    existing = await db.wholesale_applications.find_one({"email": application.email})
    if existing:
        raise HTTPException(status_code=400, detail="Eine Bewerbung mit dieser E-Mail existiert bereits")
    
    app_id = str(uuid.uuid4())
    doc = {
        "id": app_id,
        "company_name": application.company_name,
        "contact_name": application.contact_name,
        "email": application.email,
        "phone": application.phone,
        "website": application.website,
        "expected_volume": application.expected_volume,
        "business_type": application.business_type,
        "message": application.message,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.wholesale_applications.insert_one(doc)
    logger.info(f"🏢 New wholesale application: {application.company_name} ({application.email})")
    
    return {
        "success": True,
        "message": "Bewerbung erfolgreich eingereicht! Wir melden uns innerhalb von 24-48 Stunden.",
        "application_id": app_id
    }

# ==================== USER ENDPOINTS ====================

@router.get("/wholesale/status")
async def get_wholesale_status(user: dict = Depends(get_current_user)):
    """Get wholesale status for current user"""
    wholesale = await db.wholesale_customers.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    if not wholesale:
        # Check if there's a pending application
        application = await db.wholesale_applications.find_one(
            {"email": user["email"]},
            {"_id": 0}
        )
        if application:
            return {
                "is_wholesale": False,
                "application_status": application.get("status", "pending"),
                "applied_at": application.get("created_at")
            }
        return {"is_wholesale": False, "application_status": None}
    
    return {
        "is_wholesale": True,
        "company_name": wholesale.get("company_name"),
        "discount_percent": wholesale.get("discount_percent", 0),
        "credit_limit": wholesale.get("credit_limit", 0),
        "payment_terms": wholesale.get("payment_terms", "prepaid"),
        "approved_at": wholesale.get("approved_at")
    }

@router.get("/wholesale/dashboard")
async def get_wholesale_dashboard(user: dict = Depends(get_current_user)):
    """Get wholesale customer dashboard data"""
    wholesale = await db.wholesale_customers.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    if not wholesale:
        raise HTTPException(status_code=403, detail="Kein Großkundenkonto")
    
    # Get all transactions for this user
    transactions = await db.transactions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate totals
    total_spent = sum(t.get("amount", 0) for t in transactions if t.get("status") == "completed")
    total_bids_bought = sum(t.get("bids", 0) for t in transactions if t.get("status") == "completed")
    
    # Get invoices
    invoices = await db.wholesale_invoices.find(
        {"wholesale_id": wholesale["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "company_name": wholesale.get("company_name"),
        "contact_name": wholesale.get("contact_name"),
        "discount_percent": wholesale.get("discount_percent", 0),
        "credit_limit": wholesale.get("credit_limit", 0),
        "credit_used": wholesale.get("credit_used", 0),
        "credit_available": wholesale.get("credit_limit", 0) - wholesale.get("credit_used", 0),
        "payment_terms": wholesale.get("payment_terms", "prepaid"),
        "stats": {
            "total_spent": round(total_spent, 2),
            "total_bids_bought": total_bids_bought,
            "total_transactions": len(transactions),
            "savings_from_discount": round(total_spent * (wholesale.get("discount_percent", 0) / 100), 2)
        },
        "recent_transactions": transactions[:10],
        "invoices": invoices,
        "special_conditions": wholesale.get("notes", "")
    }

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/wholesale/applications")
async def get_wholesale_applications(admin: dict = Depends(get_admin_user)):
    """Get all wholesale applications"""
    applications = await db.wholesale_applications.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return applications

@router.get("/admin/wholesale/customers")
async def get_wholesale_customers(admin: dict = Depends(get_admin_user)):
    """Get all approved wholesale customers"""
    customers = await db.wholesale_customers.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return customers

@router.post("/admin/wholesale/approve/{application_id}")
async def approve_wholesale_application(
    application_id: str,
    settings: WholesaleUpdate,
    admin: dict = Depends(get_admin_user)
):
    """Approve a wholesale application and activate customer account"""
    application = await db.wholesale_applications.find_one({"id": application_id})
    
    # Check if this is a self-registered customer (has wholesale_id)
    if application and application.get("wholesale_id"):
        # Self-registered customer - update existing wholesale_customers record
        wholesale_id = application["wholesale_id"]
        
        await db.wholesale_customers.update_one(
            {"id": wholesale_id},
            {"$set": {
                "discount_percent": settings.discount_percent or 10,
                "credit_limit": settings.credit_limit or 0,
                "payment_terms": settings.payment_terms or "prepaid",
                "notes": settings.notes or "",
                "status": "active",
                "approved_by": admin["id"],
                "approved_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        await db.wholesale_applications.update_one(
            {"id": application_id},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        customer = await db.wholesale_customers.find_one({"id": wholesale_id})
        
        # Send welcome/activation email
        try:
            await send_wholesale_welcome_email(
                to_email=customer["email"],
                contact_name=customer["contact_name"],
                company_name=customer["company_name"],
                discount_percent=settings.discount_percent or 10,
                credit_limit=settings.credit_limit or 0,
                payment_terms=settings.payment_terms or "prepaid",
                has_user_account=True  # They have a B2B account
            )
            logger.info(f"📧 Wholesale activation email sent to {customer['email']}")
        except Exception as e:
            logger.error(f"❌ Failed to send wholesale activation email: {e}")
        
        logger.info(f"🏢 Wholesale customer activated: {customer['company_name']}")
        
        return {
            "success": True, 
            "message": "Großkunde erfolgreich freigeschaltet",
            "wholesale_id": wholesale_id,
            "user_linked": True,
            "email_sent": True
        }
    
    # Legacy flow - application without wholesale_id (old system)
    if not application:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    
    # Find associated user account
    user = await db.users.find_one({"email": application["email"]})
    user_id = user["id"] if user else None
    
    # Create wholesale customer record even without user account
    # User can be linked later when they register
    wholesale_id = str(uuid.uuid4())
    wholesale_doc = {
        "id": wholesale_id,
        "user_id": user_id,  # Can be None if user hasn't registered yet
        "company_name": application["company_name"],
        "contact_name": application["contact_name"],
        "email": application["email"],
        "phone": application.get("phone"),
        "website": application.get("website"),
        "discount_percent": settings.discount_percent or 10,
        "credit_limit": settings.credit_limit or 0,
        "credit_used": 0,
        "payment_terms": settings.payment_terms or "prepaid",
        "notes": settings.notes or "",
        "status": "active",
        "approved_by": admin["id"],
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.wholesale_customers.insert_one(wholesale_doc)
    
    # Update application status
    await db.wholesale_applications.update_one(
        {"id": application_id},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Mark user as wholesale if user exists
    if user:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"is_wholesale": True, "wholesale_id": wholesale_id}}
        )
        logger.info(f"🏢 Wholesale customer approved: {application['company_name']} (linked to user)")
    else:
        logger.info(f"🏢 Wholesale customer approved: {application['company_name']} (no user account yet - will be linked on registration)")
    
    # Send welcome email to wholesale customer
    try:
        await send_wholesale_welcome_email(
            to_email=application["email"],
            contact_name=application["contact_name"],
            company_name=application["company_name"],
            discount_percent=settings.discount_percent or 10,
            credit_limit=settings.credit_limit or 0,
            payment_terms=settings.payment_terms or "prepaid",
            has_user_account=user is not None
        )
        logger.info(f"📧 Wholesale welcome email sent to {application['email']}")
    except Exception as e:
        logger.error(f"❌ Failed to send wholesale welcome email: {e}")
    
    return {
        "success": True, 
        "message": "Großkunde erfolgreich freigeschaltet" + (" (Benutzerkonto wird bei Registrierung verknüpft)" if not user else ""), 
        "wholesale_id": wholesale_id,
        "user_linked": user is not None,
        "email_sent": True
    }

@router.post("/admin/wholesale/reject/{application_id}")
async def reject_wholesale_application(application_id: str, admin: dict = Depends(get_admin_user)):
    """Reject a wholesale application"""
    result = await db.wholesale_applications.update_one(
        {"id": application_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    
    return {"success": True, "message": "Bewerbung abgelehnt"}

@router.put("/admin/wholesale/{wholesale_id}")
async def update_wholesale_customer(
    wholesale_id: str,
    settings: WholesaleUpdate,
    admin: dict = Depends(get_admin_user)
):
    """Update wholesale customer settings"""
    update_data = {}
    if settings.discount_percent is not None:
        update_data["discount_percent"] = settings.discount_percent
    if settings.credit_limit is not None:
        update_data["credit_limit"] = settings.credit_limit
    if settings.payment_terms is not None:
        update_data["payment_terms"] = settings.payment_terms
    if settings.notes is not None:
        update_data["notes"] = settings.notes
    if settings.status is not None:
        update_data["status"] = settings.status
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.wholesale_customers.update_one(
        {"id": wholesale_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Großkunde nicht gefunden")
    
    return {"success": True, "message": "Großkunde aktualisiert"}

@router.delete("/admin/wholesale/{wholesale_id}")
async def delete_wholesale_customer(wholesale_id: str, admin: dict = Depends(get_admin_user)):
    """Remove wholesale status from a customer"""
    wholesale = await db.wholesale_customers.find_one({"id": wholesale_id})
    if not wholesale:
        raise HTTPException(status_code=404, detail="Großkunde nicht gefunden")
    
    # Remove wholesale status from user
    await db.users.update_one(
        {"id": wholesale["user_id"]},
        {"$unset": {"is_wholesale": "", "wholesale_id": ""}}
    )
    
    # Delete wholesale record
    await db.wholesale_customers.delete_one({"id": wholesale_id})
    
    return {"success": True, "message": "Großkundenstatus entfernt"}
