"""BidBlitz Pay - Merchant Application & Admin Approval System."""
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from core.database import db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/pay", tags=["BidBlitz Pay Merchant Requests"])


class MerchantApplicationRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    website: Optional[str] = Field("", max_length=200)
    description: Optional[str] = Field("", max_length=500)


class AdminApprovalRequest(BaseModel):
    application_id: str
    decision: str = Field(..., pattern="^(approve|reject)$")
    reason: Optional[str] = Field("", max_length=300)


@router.post("/merchant/apply")
async def apply_for_pay(req: MerchantApplicationRequest):
    """Public endpoint - Anyone can apply for BidBlitz Pay access."""
    # Check if already applied
    existing = await db.pay_merchant_applications.find_one(
        {"email": req.email, "status": {"$in": ["pending", "approved"]}}
    )
    if existing:
        raise HTTPException(400, "Du hast bereits einen offenen oder genehmigten Antrag.")
    
    application = {
        "application_id": secrets.token_hex(8),
        "business_name": req.business_name,
        "email": req.email,
        "website": req.website or "",
        "description": req.description or "",
        "status": "pending",  # pending | approved | rejected
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
        "rejection_reason": None,
    }
    await db.pay_merchant_applications.insert_one(application)
    application.pop("_id", None)
    
    return {
        "ok": True,
        "application_id": application["application_id"],
        "status": "pending",
        "message": "Dein Antrag wurde eingereicht. Wir melden uns innerhalb von 24h.",
    }


@router.get("/admin/applications")
async def admin_list_applications(request: Request, status: str = "pending"):
    """Admin - List all merchant applications (pending/approved/rejected)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    
    query = {} if status == "all" else {"status": status}
    apps = await db.pay_merchant_applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    return {
        "applications": apps,
        "count": len(apps),
    }


@router.post("/admin/applications/decide")
async def admin_decide_application(req: AdminApprovalRequest, request: Request):
    """Admin - Approve or reject a merchant application."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    
    app = await db.pay_merchant_applications.find_one({"application_id": req.application_id})
    if not app:
        raise HTTPException(404, "Antrag nicht gefunden")
    
    if app["status"] != "pending":
        raise HTTPException(400, f"Antrag bereits {app['status']}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if req.decision == "approve":
        # Create merchant user if doesn't exist
        existing_user = await db.users.find_one({"email": app["email"]})
        if not existing_user:
            # Create merchant account
            temp_password = secrets.token_urlsafe(12)
            user_doc = {
                "email": app["email"],
                "name": app["business_name"],
                "business_name": app["business_name"],
                "role": "merchant",
                "password": temp_password,  # User should reset via email
                "balance": 0.0,
                "created_at": now,
            }
            await db.users.insert_one(user_doc)
            # TODO: Send email with temp password
        else:
            # Upgrade to merchant if not already
            if existing_user.get("role") != "merchant":
                await db.users.update_one(
                    {"email": app["email"]},
                    {"$set": {"role": "merchant", "business_name": app["business_name"]}}
                )
        
        await db.pay_merchant_applications.update_one(
            {"application_id": req.application_id},
            {"$set": {
                "status": "approved",
                "reviewed_at": now,
                "reviewed_by": str(user.get("_id", "")),
            }}
        )
        return {"ok": True, "status": "approved", "message": f"Antrag genehmigt. {app['email']} ist jetzt Merchant."}
    
    else:  # reject
        await db.pay_merchant_applications.update_one(
            {"application_id": req.application_id},
            {"$set": {
                "status": "rejected",
                "reviewed_at": now,
                "reviewed_by": str(user.get("_id", "")),
                "rejection_reason": req.reason or "Keine Angabe",
            }}
        )
        return {"ok": True, "status": "rejected", "message": "Antrag abgelehnt."}
