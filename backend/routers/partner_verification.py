"""
Partner Verification - Document upload and verification workflow
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import base64
import uuid

from config import db, logger

router = APIRouter(prefix="/partner-verification", tags=["Partner Verification"])

# Document types
DOCUMENT_TYPES = [
    {"id": "business_registration", "name": "Gewerbeanmeldung", "name_en": "Business Registration", "required": True},
    {"id": "trade_register", "name": "Handelsregisterauszug", "name_en": "Trade Register Extract", "required": False},
    {"id": "tax_certificate", "name": "Steuerbescheinigung", "name_en": "Tax Certificate", "required": False},
    {"id": "id_document", "name": "Personalausweis/Reisepass", "name_en": "ID/Passport", "required": True},
    {"id": "address_proof", "name": "Adressnachweis", "name_en": "Proof of Address", "required": False},
    {"id": "bank_statement", "name": "Kontoauszug", "name_en": "Bank Statement", "required": False},
]

VERIFICATION_STATUSES = {
    "pending": {"name": "Ausstehend", "color": "#F59E0B"},
    "in_review": {"name": "In Pruefung", "color": "#3B82F6"},
    "approved": {"name": "Genehmigt", "color": "#10B981"},
    "rejected": {"name": "Abgelehnt", "color": "#EF4444"},
    "more_info": {"name": "Mehr Info benoetigt", "color": "#8B5CF6"},
}

# ==================== DOCUMENT UPLOAD ====================

@router.get("/document-types")
async def get_document_types():
    """Get available document types"""
    return DOCUMENT_TYPES

@router.post("/upload-document")
async def upload_document(
    token: str,
    document_type: str = Form(...),
    document: UploadFile = File(...)
):
    """Upload a verification document"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    # Validate document type
    valid_types = [dt["id"] for dt in DOCUMENT_TYPES]
    if document_type not in valid_types:
        raise HTTPException(status_code=400, detail="Ungueltiger Dokumenttyp")
    
    # Validate file type
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if document.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Nur PDF, JPEG, PNG oder WebP erlaubt")
    
    # Read file
    contents = await document.read()
    
    # Validate file size (max 10MB)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Maximale Dateigroesse: 10MB")
    
    # Store as base64 (in production, use cloud storage)
    file_base64 = base64.b64encode(contents).decode()
    file_url = f"data:{document.content_type};base64,{file_base64}"
    
    document_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc_record = {
        "id": document_id,
        "partner_id": partner["id"],
        "document_type": document_type,
        "file_name": document.filename,
        "file_type": document.content_type,
        "file_size": len(contents),
        "file_url": file_url,
        "status": "pending",
        "uploaded_at": now,
        "reviewed_at": None,
        "reviewed_by": None,
        "rejection_reason": None,
        "notes": None
    }
    
    await db.partner_documents.insert_one(doc_record)
    
    # Update partner verification status if first document
    partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
    
    # Check if all required documents are uploaded
    uploaded_types = await db.partner_documents.distinct(
        "document_type",
        {"partner_id": partner["id"], "status": {"$ne": "rejected"}}
    )
    
    required_types = [dt["id"] for dt in DOCUMENT_TYPES if dt["required"]]
    all_required_uploaded = all(rt in uploaded_types for rt in required_types)
    
    await partner_collection.update_one(
        {"id": partner["id"]},
        {"$set": {
            "verification_status": "in_review" if all_required_uploaded else "pending",
            "documents_submitted": True,
            "updated_at": now
        }}
    )
    
    logger.info(f"Partner {partner['id']} uploaded document: {document_type}")
    
    return {
        "success": True,
        "message": "Dokument hochgeladen!",
        "document_id": document_id,
        "all_required_uploaded": all_required_uploaded
    }

@router.get("/my-documents")
async def get_my_documents(token: str):
    """Get all documents uploaded by the partner"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    documents = await db.partner_documents.find(
        {"partner_id": partner["id"]},
        {"_id": 0, "file_url": 0}  # Don't send file content for list
    ).sort("uploaded_at", -1).to_list(100)
    
    # Get document type info
    doc_type_map = {dt["id"]: dt for dt in DOCUMENT_TYPES}
    for doc in documents:
        doc["type_info"] = doc_type_map.get(doc["document_type"], {})
        doc["status_info"] = VERIFICATION_STATUSES.get(doc["status"], {})
    
    # Check required documents
    uploaded_types = set(doc["document_type"] for doc in documents if doc["status"] != "rejected")
    required_types = [dt for dt in DOCUMENT_TYPES if dt["required"]]
    
    missing_required = [
        dt for dt in required_types 
        if dt["id"] not in uploaded_types
    ]
    
    return {
        "documents": documents,
        "total": len(documents),
        "missing_required": missing_required,
        "verification_status": partner.get("verification_status", "pending"),
        "is_verified": partner.get("is_verified", False)
    }

@router.get("/verification-status")
async def get_verification_status(token: str):
    """Get overall verification status"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    # Count documents by status
    pipeline = [
        {"$match": {"partner_id": partner["id"]}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.partner_documents.aggregate(pipeline).to_list(10)
    status_dict = {s["_id"]: s["count"] for s in status_counts}
    
    # Get required documents status
    required_types = [dt["id"] for dt in DOCUMENT_TYPES if dt["required"]]
    approved_required = await db.partner_documents.count_documents({
        "partner_id": partner["id"],
        "document_type": {"$in": required_types},
        "status": "approved"
    })
    
    all_required_approved = approved_required >= len(required_types)
    
    return {
        "overall_status": partner.get("verification_status", "pending"),
        "is_verified": partner.get("is_verified", False),
        "document_counts": status_dict,
        "required_documents": len(required_types),
        "approved_required": approved_required,
        "all_required_approved": all_required_approved,
        "status_info": VERIFICATION_STATUSES.get(partner.get("verification_status", "pending"))
    }

@router.delete("/document/{document_id}")
async def delete_document(document_id: str, token: str):
    """Delete a pending document"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    doc = await db.partner_documents.find_one({
        "id": document_id,
        "partner_id": partner["id"]
    })
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    if doc["status"] not in ["pending", "rejected"]:
        raise HTTPException(status_code=400, detail="Nur ausstehende oder abgelehnte Dokumente koennen geloescht werden")
    
    await db.partner_documents.delete_one({"id": document_id})
    
    return {"success": True, "message": "Dokument geloescht"}

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending-verifications")
async def get_pending_verifications():
    """Get all partners with pending verification (Admin only)"""
    # Get all documents pending review
    pipeline = [
        {"$match": {"status": "pending"}},
        {"$group": {
            "_id": "$partner_id",
            "documents": {"$push": {
                "id": "$id",
                "type": "$document_type",
                "file_name": "$file_name",
                "uploaded_at": "$uploaded_at"
            }},
            "count": {"$sum": 1}
        }}
    ]
    
    pending_by_partner = await db.partner_documents.aggregate(pipeline).to_list(100)
    
    # Get partner info
    results = []
    for item in pending_by_partner:
        partner = await db.partner_accounts.find_one(
            {"id": item["_id"]},
            {"_id": 0, "password_hash": 0, "auth_token": 0}
        )
        if not partner:
            partner = await db.restaurant_accounts.find_one(
                {"id": item["_id"]},
                {"_id": 0, "password_hash": 0, "auth_token": 0}
            )
        
        if partner:
            results.append({
                "partner": partner,
                "pending_documents": item["documents"],
                "pending_count": item["count"]
            })
    
    return {
        "verifications": results,
        "total": len(results)
    }

@router.get("/admin/document/{document_id}")
async def get_document_for_review(document_id: str):
    """Get a document for admin review (includes file content)"""
    doc = await db.partner_documents.find_one(
        {"id": document_id},
        {"_id": 0}
    )
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    # Get partner info
    partner = await db.partner_accounts.find_one(
        {"id": doc["partner_id"]},
        {"_id": 0, "business_name": 1, "email": 1, "business_type": 1}
    )
    if not partner:
        partner = await db.restaurant_accounts.find_one(
            {"id": doc["partner_id"]},
            {"_id": 0, "restaurant_name": 1, "email": 1}
        )
    
    doc["partner_info"] = partner
    doc["type_info"] = next((dt for dt in DOCUMENT_TYPES if dt["id"] == doc["document_type"]), {})
    
    return doc

@router.post("/admin/approve/{document_id}")
async def approve_document(document_id: str, notes: str = None):
    """Approve a verification document (Admin only)"""
    doc = await db.partner_documents.find_one({"id": document_id})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.partner_documents.update_one(
        {"id": document_id},
        {"$set": {
            "status": "approved",
            "reviewed_at": now,
            "notes": notes
        }}
    )
    
    # Check if all required documents are approved
    partner_id = doc["partner_id"]
    required_types = [dt["id"] for dt in DOCUMENT_TYPES if dt["required"]]
    
    approved_required = await db.partner_documents.count_documents({
        "partner_id": partner_id,
        "document_type": {"$in": required_types},
        "status": "approved"
    })
    
    all_approved = approved_required >= len(required_types)
    
    # Update partner verification status
    partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner_id}) else db.restaurant_accounts
    await partner_collection.update_one(
        {"id": partner_id},
        {"$set": {
            "verification_status": "approved" if all_approved else "in_review",
            "is_verified": all_approved,
            "verified_at": now if all_approved else None,
            "updated_at": now
        }}
    )
    
    logger.info(f"Document {document_id} approved. Partner fully verified: {all_approved}")
    
    return {
        "success": True,
        "message": "Dokument genehmigt",
        "partner_fully_verified": all_approved
    }

@router.post("/admin/reject/{document_id}")
async def reject_document(document_id: str, reason: str = "Dokument nicht akzeptiert"):
    """Reject a verification document (Admin only)"""
    doc = await db.partner_documents.find_one({"id": document_id})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.partner_documents.update_one(
        {"id": document_id},
        {"$set": {
            "status": "rejected",
            "reviewed_at": now,
            "rejection_reason": reason
        }}
    )
    
    # Update partner status
    partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": doc["partner_id"]}) else db.restaurant_accounts
    await partner_collection.update_one(
        {"id": doc["partner_id"]},
        {"$set": {
            "verification_status": "more_info",
            "updated_at": now
        }}
    )
    
    logger.info(f"Document {document_id} rejected: {reason}")
    
    return {
        "success": True,
        "message": "Dokument abgelehnt",
        "reason": reason
    }

partner_verification_router = router
