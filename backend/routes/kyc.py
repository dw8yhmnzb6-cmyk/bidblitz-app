"""
BidBlitz V2 - KYC (Know Your Customer) System
3-photo verification: ID front + ID back + Selfie holding ID
Powered by Gemini Vision AI for automatic verdict.
"""
import os
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from services.kyc_ai_verifier import verify_id_documents, auto_decision

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/kyc", tags=["kyc"])

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_BYTES = 10 * 1024 * 1024  # 10MB per file
ALLOWED_DOC_TYPES = {"national_id", "passport", "drivers_license"}

UPLOAD_BASE = "/app/backend/uploads/kyc"
os.makedirs(UPLOAD_BASE, exist_ok=True)


# ─── Models ──────────────────────────────────────────────────────
class KYCStatusResponse(BaseModel):
    kyc_verified: bool
    kyc_status: str
    document_type: Optional[str] = None
    submitted_at: Optional[str] = None
    reviewed_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    ai_confidence: Optional[int] = None
    can_use_features: dict


# ─── Helpers ─────────────────────────────────────────────────────
def _capabilities(kyc_status: str) -> dict:
    """What can a user do based on their KYC status?"""
    verified = (kyc_status == "approved")
    return {
        "browse": True,                 # Always allowed
        "wallet_topup": verified,
        "wallet_send": verified,
        "wallet_withdraw": verified,
        "place_bids": verified,
        "buy_marketplace": verified,
        "sell_marketplace": verified,
        "request_taxi": verified,
        "drive_taxi": verified,
        "merchant_actions": verified,
    }


async def _save_upload(uf: UploadFile, dest: str) -> int:
    """Save upload, returning bytes written. Streams to disk."""
    total = 0
    with open(dest, "wb") as f:
        while True:
            chunk = await uf.read(64 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_BYTES:
                f.close()
                os.remove(dest)
                raise HTTPException(status_code=413, detail=f"Datei zu groß (max 10 MB): {uf.filename}")
            f.write(chunk)
    return total


def _validate_image(uf: UploadFile, label: str):
    if uf.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Ungültiger Dateityp für {label} (JPG/PNG/WebP)")


# ─── Endpoints ───────────────────────────────────────────────────
@router.get("/status", response_model=KYCStatusResponse)
async def get_kyc_status(request: Request):
    """Get user's KYC verification status + capabilities."""
    user = await get_current_user(request)
    kyc_status = user.get("kyc_status", "not_started")
    return KYCStatusResponse(
        kyc_verified=kyc_status == "approved",
        kyc_status=kyc_status,
        document_type=user.get("kyc_document_type"),
        submitted_at=user.get("kyc_submitted_at"),
        reviewed_at=user.get("kyc_reviewed_at"),
        rejection_reason=user.get("kyc_rejection_reason") if kyc_status == "rejected" else None,
        ai_confidence=user.get("kyc_ai_confidence"),
        can_use_features=_capabilities(kyc_status),
    )


@router.post("/submit")
async def submit_kyc(
    request: Request,
    id_front: UploadFile = File(..., description="Vorderseite Ausweis"),
    id_back: UploadFile = File(..., description="Rückseite Ausweis"),
    selfie: UploadFile = File(..., description="Selfie mit Ausweis in der Hand"),
    document_type: str = Form("national_id"),
):
    """
    Submit 3-photo KYC: ID front + ID back + selfie holding ID.
    Backend automatically runs Gemini Vision verification.
    Returns ai_verdict + final status (approved | pending | rejected).
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if document_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail="document_type must be one of: " + ", ".join(ALLOWED_DOC_TYPES))

    if user.get("kyc_status") == "approved":
        raise HTTPException(status_code=400, detail="KYC bereits verifiziert")
    if user.get("kyc_status") == "pending":
        raise HTTPException(status_code=400, detail="KYC bereits eingereicht. Warte auf Prüfung.")

    # Validate uploads
    _validate_image(id_front, "Vorderseite")
    _validate_image(id_back, "Rückseite")
    _validate_image(selfie, "Selfie")

    # Save files
    upload_dir = os.path.join(UPLOAD_BASE, user_id)
    os.makedirs(upload_dir, exist_ok=True)

    def _path(prefix: str, fn: Optional[str]) -> str:
        ext = "jpg"
        if fn and "." in fn:
            ext = fn.rsplit(".", 1)[-1].lower()
            if ext not in ("jpg", "jpeg", "png", "webp"):
                ext = "jpg"
        return os.path.join(upload_dir, f"{prefix}_{secrets.token_hex(4)}.{ext}")

    front_path = _path("front", id_front.filename)
    back_path = _path("back", id_back.filename)
    selfie_path = _path("selfie", selfie.filename)

    await _save_upload(id_front, front_path)
    await _save_upload(id_back, back_path)
    await _save_upload(selfie, selfie_path)

    now = datetime.now(timezone.utc).isoformat()

    # Mark pending immediately
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "kyc_status": "pending",
            "kyc_document_type": document_type,
            "kyc_front_path": front_path,
            "kyc_back_path": back_path,
            "kyc_selfie_path": selfie_path,
            "kyc_submitted_at": now,
        }},
    )

    # Run AI verification
    verdict = await verify_id_documents(front_path, back_path, selfie_path)
    decision = auto_decision(verdict)

    update = {
        "kyc_ai_verdict": verdict,
        "kyc_ai_confidence": verdict.get("overall_confidence", 0),
        "kyc_ai_decision": decision,
        "kyc_extracted_name": verdict.get("full_name"),
        "kyc_extracted_dob": verdict.get("date_of_birth"),
        "kyc_extracted_doc_number": verdict.get("document_number"),
        "kyc_status": decision if decision != "pending" else "pending",
    }
    if decision == "approved":
        update["kyc_verified"] = True
        update["kyc_reviewed_at"] = now
        update["kyc_reviewed_by"] = "ai_auto"
    elif decision == "rejected":
        update["kyc_verified"] = False
        update["kyc_reviewed_at"] = now
        update["kyc_reviewed_by"] = "ai_auto"
        update["kyc_rejection_reason"] = verdict.get("fraud_signals") or "AI-Prüfung fehlgeschlagen"

    await db.users.update_one({"_id": user["_id"]}, {"$set": update})

    # Insert/update review entry for admin
    await db.kyc_reviews.update_one(
        {"user_id": user_id, "submitted_at": now},
        {
            "$set": {
                "user_id": user_id,
                "user_name": user.get("name") or user.get("email", ""),
                "user_email": user.get("email", ""),
                "document_type": document_type,
                "front_path": front_path,
                "back_path": back_path,
                "selfie_path": selfie_path,
                "status": decision,
                "ai_verdict": verdict,
                "submitted_at": now,
            }
        },
        upsert=True,
    )

    return {
        "ok": True,
        "status": decision,
        "ai_confidence": verdict.get("overall_confidence", 0),
        "ai_recommendation": verdict.get("recommendation"),
        "extracted": {
            "name": verdict.get("full_name"),
            "date_of_birth": verdict.get("date_of_birth"),
            "document_type": verdict.get("document_type"),
        },
        "message": (
            "Verifizierung erfolgreich!" if decision == "approved"
            else "Wir haben deine Dokumente erhalten und prüfen sie." if decision == "pending"
            else f"Verifizierung abgelehnt: {verdict.get('fraud_signals') or 'Bitte erneut versuchen.'}"
        ),
        "capabilities": _capabilities(decision if decision != "pending" else "pending"),
    }


# ─── Image serving (for admin review) ────────────────────────────
@router.get("/admin/image/{user_id}/{kind}")
async def get_kyc_image(user_id: str, kind: str, request: Request):
    """Admin: Stream a stored KYC image. kind=front|back|selfie"""
    from fastapi.responses import FileResponse
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if kind not in ("front", "back", "selfie"):
        raise HTTPException(status_code=400, detail="Invalid kind")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    path_field = {"front": "kyc_front_path", "back": "kyc_back_path", "selfie": "kyc_selfie_path"}[kind]
    path = user.get(path_field)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


# ─── Admin endpoints ─────────────────────────────────────────────
@router.get("/admin/list")
async def list_kyc_reviews(status: Optional[str] = None, limit: int = 100, request: Request = None):
    """Admin: list KYC reviews. status=pending|approved|rejected|all"""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = {} if status in (None, "all") else {"status": status}
    reviews = await db.kyc_reviews.find(query, {"_id": 0}).sort("submitted_at", -1).limit(limit).to_list(limit)
    return {"reviews": reviews, "total": len(reviews)}


@router.post("/admin/decide")
async def admin_decide(
    request: Request,
    user_id: str = Form(...),
    decision: str = Form(...),  # approve | reject
    rejection_reason: Optional[str] = Form(None),
):
    """Admin: override AI decision."""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="decision must be approve|reject")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc).isoformat()
    new_status = "approved" if decision == "approve" else "rejected"
    update = {
        "kyc_status": new_status,
        "kyc_verified": decision == "approve",
        "kyc_reviewed_at": now,
        "kyc_reviewed_by": str(admin["_id"]),
    }
    if decision == "reject" and rejection_reason:
        update["kyc_rejection_reason"] = rejection_reason
    await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    await db.kyc_reviews.update_many(
        {"user_id": user_id},
        {"$set": {"status": new_status, "reviewed_at": now, "reviewed_by": str(admin["_id"]),
                  "rejection_reason": rejection_reason}},
    )
    return {"ok": True, "user_id": user_id, "status": new_status}


# ─── Gating helper for other routers ─────────────────────────────
async def require_kyc_verified(request: Request) -> dict:
    """Use as FastAPI dependency on protected endpoints."""
    user = await get_current_user(request)
    if user.get("kyc_status") != "approved" and user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "Bitte verifiziere deinen Ausweis, um diese Funktion zu nutzen.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )
    return user
