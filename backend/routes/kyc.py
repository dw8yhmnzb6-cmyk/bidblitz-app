"""
BidBlitz V2 - KYC (Know Your Customer) System
ID verification system for high-value withdrawals (>€1000).
Supports ID upload (passport, driver's license, national ID) + selfie verification.
"""
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/kyc", tags=["kyc"])


class KYCStatusResponse(BaseModel):
    kyc_verified: bool
    kyc_status: Optional[str] = None
    kyc_submitted_at: Optional[str] = None
    withdrawal_limit: float


@router.get("/status")
async def get_kyc_status(request: Request):
    """Get user's KYC verification status."""
    user = await get_current_user(request)
    
    kyc_verified = user.get("kyc_verified", False)
    kyc_status = user.get("kyc_status", "not_started")  # not_started, pending, approved, rejected
    
    # Withdrawal limits
    withdrawal_limit = 10000.0 if kyc_verified else 100.0
    
    return {
        "kyc_verified": kyc_verified,
        "kyc_status": kyc_status,
        "kyc_submitted_at": user.get("kyc_submitted_at"),
        "kyc_reviewed_at": user.get("kyc_reviewed_at"),
        "withdrawal_limit": withdrawal_limit,
        "rejection_reason": user.get("kyc_rejection_reason") if kyc_status == "rejected" else None,
    }


@router.post("/submit")
async def submit_kyc(
    request: Request,
    id_document: UploadFile = File(...),
    selfie: UploadFile = File(...),
    document_type: str = "passport",  # passport, drivers_license, national_id
):
    """
    Submit KYC documents (ID + selfie).
    Files are stored in /app/backend/uploads/kyc/{user_id}/
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check if already verified or pending
    if user.get("kyc_status") == "approved":
        raise HTTPException(status_code=400, detail="KYC bereits verifiziert")
    
    if user.get("kyc_status") == "pending":
        raise HTTPException(status_code=400, detail="KYC bereits eingereicht. Warte auf Prüfung.")
    
    # Validate file types
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]
    if id_document.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Ungültiger Dateityp für ID-Dokument")
    if selfie.content_type not in ["image/jpeg", "image/jpg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Ungültiger Dateityp für Selfie")
    
    # Save files
    import os
    upload_dir = f"/app/backend/uploads/kyc/{user_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    id_filename = f"id_{secrets.token_hex(4)}.{id_document.filename.split('.')[-1]}"
    selfie_filename = f"selfie_{secrets.token_hex(4)}.{selfie.filename.split('.')[-1]}"
    
    id_path = os.path.join(upload_dir, id_filename)
    selfie_path = os.path.join(upload_dir, selfie_filename)
    
    with open(id_path, "wb") as f:
        f.write(await id_document.read())
    
    with open(selfie_path, "wb") as f:
        f.write(await selfie.read())
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update user
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "kyc_status": "pending",
                "kyc_document_type": document_type,
                "kyc_id_path": id_path,
                "kyc_selfie_path": selfie_path,
                "kyc_submitted_at": now,
            }
        },
    )
    
    # Create KYC review entry for admin
    await db.kyc_reviews.insert_one({
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "document_type": document_type,
        "id_path": id_path,
        "selfie_path": selfie_path,
        "status": "pending",
        "submitted_at": now,
    })
    
    return {
        "ok": True,
        "message": "KYC eingereicht. Prüfung dauert 1-3 Werktage.",
        "status": "pending",
    }


# Admin endpoints
@router.get("/admin/pending")
async def get_pending_kyc_reviews(request: Request):
    """Admin: Get all pending KYC reviews."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    reviews = await db.kyc_reviews.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("submitted_at", 1).to_list(100)
    
    return {"reviews": reviews, "total": len(reviews)}


@router.post("/admin/review")
async def review_kyc(
    request: Request,
    user_id: str,
    approve: bool,
    rejection_reason: Optional[str] = None,
):
    """Admin: Approve or reject KYC."""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc).isoformat()
    new_status = "approved" if approve else "rejected"
    
    # Update user
    update_data = {
        "kyc_status": new_status,
        "kyc_verified": approve,
        "kyc_reviewed_at": now,
        "kyc_reviewed_by": str(admin["_id"]),
    }
    if not approve and rejection_reason:
        update_data["kyc_rejection_reason"] = rejection_reason
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": update_data},
    )
    
    # Update review
    await db.kyc_reviews.update_one(
        {"user_id": user_id, "status": "pending"},
        {
            "$set": {
                "status": new_status,
                "reviewed_at": now,
                "reviewed_by": str(admin["_id"]),
                "rejection_reason": rejection_reason,
            }
        },
    )
    
    return {
        "ok": True,
        "user_id": user_id,
        "status": new_status,
    }
