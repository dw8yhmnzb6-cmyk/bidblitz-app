"""
BidBlitz V2 — Identity Verification System
Upload ID documents for role verification (merchant, influencer, manager, investor).
Admin reviews and approves/rejects.
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from core.database import db
from bson import ObjectId

router = APIRouter(prefix="/api/verification", tags=["Verification"])
logger = logging.getLogger("bidblitz.verification")

UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "verification"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

ROLES_REQUIRING_VERIFICATION = {"merchant", "influencer", "manager", "investor"}


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


def save_upload(file_bytes: bytes, ext: str) -> str:
    fname = f"{uuid.uuid4().hex}{ext}"
    path = UPLOAD_DIR / fname
    path.write_bytes(file_bytes)
    return fname


# ══════════════════════════════════════
# USER: Upload verification documents
# ══════════════════════════════════════

@router.post("/upload")
async def upload_verification(
    request: Request,
    id_front: UploadFile = File(...),
    id_back: UploadFile = File(...),
    selfie: UploadFile = File(...),
):
    """Upload ID front, ID back, and selfie with ID for verification."""
    user = await get_current_user(request)
    uid = str(user["_id"])

    requested = user.get("requested_role") or ""
    if requested not in ROLES_REQUIRING_VERIFICATION:
        # Also check pending role requests
        pending_req = await db.role_requests.find_one({"user_id": uid, "status": "pending"})
        if not pending_req or pending_req.get("requested_role") not in ROLES_REQUIRING_VERIFICATION:
            raise HTTPException(status_code=400, detail="No role verification required")

    existing = await db.verifications.find_one({"user_id": uid, "status": {"$in": ["pending", "approved"]}})
    if existing:
        raise HTTPException(status_code=400, detail="Verification already submitted or approved")

    files = {"id_front": id_front, "id_back": id_back, "selfie": selfie}
    saved = {}

    for key, f in files.items():
        ext = Path(f.filename).suffix.lower() if f.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Invalid file type for {key}: {ext}")
        data = await f.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File {key} too large (max 5MB)")
        saved[key] = save_upload(data, ext)

    doc = {
        "user_id": uid,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "requested_role": requested or (pending_req.get("requested_role") if pending_req else ""),
        "id_front": saved["id_front"],
        "id_back": saved["id_back"],
        "selfie": saved["selfie"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.verifications.insert_one(doc)
    doc.pop("_id", None)
    
    # Send KYC pending status email
    try:
        from core.email import send_kyc_status_email
        send_kyc_status_email(
            to=user.get("email", ""),
            status="pending",
            user_name=user.get("name", "")
        )
    except Exception as e:
        logger.warning(f"Failed to send KYC pending email: {e}")
    
    return {"ok": True, "status": "pending", "verification": doc}


@router.get("/my-status")
async def get_my_verification(request: Request):
    """Get user's verification status."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    ver = await db.verifications.find_one(
        {"user_id": uid}, {"_id": 0}
    )
    role_req = await db.role_requests.find_one(
        {"user_id": uid}, {"_id": 0}
    )
    
    # Determine if user needs verification for high-value actions
    is_verified = ver and ver.get("status") == "approved"
    verification_required = user.get("balance", 0) > 1000 or user.get("role") in ROLES_REQUIRING_VERIFICATION
    
    return {
        "verification": ver,
        "role_request": role_req,
        "current_role": user.get("role", "user"),
        "requested_role": user.get("requested_role", ""),
        "is_verified": is_verified,
        "verification_required": verification_required,
        "can_high_value_txn": is_verified or not verification_required,
    }


# Alias for backwards compatibility
@router.get("/status")
async def get_verification_status_alias(request: Request):
    """Alias for /my-status endpoint."""
    return await get_my_verification(request)


# ══════════════════════════════════════
# Serve uploaded files (admin only or self)
# ══════════════════════════════════════

@router.get("/file/{filename}")
async def serve_verification_file(filename: str, request: Request):
    """Serve verification document file."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    is_admin = user.get("role") == "admin"

    if not is_admin:
        ver = await db.verifications.find_one({"user_id": uid})
        if not ver or filename not in (ver.get("id_front"), ver.get("id_back"), ver.get("selfie")):
            raise HTTPException(status_code=403, detail="Access denied")

    path = UPLOAD_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path))


# ══════════════════════════════════════
# ADMIN: Review verifications
# ══════════════════════════════════════

@router.get("/admin/list")
async def admin_list_verifications(request: Request, status: str = "pending"):
    """Admin: list verifications by status."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = {} if status == "all" else {"status": status}
    items = await db.verifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"verifications": items, "total": len(items)}


@router.post("/admin/decide")
async def admin_decide_verification(request: Request):
    """Admin approves or rejects a verification."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    body = await request.json()
    user_id = body.get("user_id")
    decision = body.get("decision")  # "approve" or "reject"
    reason = body.get("reason", "")

    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid decision")

    ver = await db.verifications.find_one({"user_id": user_id, "status": "pending"})
    if not ver:
        raise HTTPException(status_code=404, detail="No pending verification found")

    now = datetime.now(timezone.utc).isoformat()
    new_status = "approved" if decision == "approve" else "rejected"

    await db.verifications.update_one(
        {"user_id": user_id, "status": "pending"},
        {"$set": {
            "status": new_status,
            "decided_at": now,
            "decided_by": str(user["_id"]),
            "reason": reason,
        }},
    )

    # Get target user's email for notification
    target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    target_email = target_user.get("email", "") if target_user else ""
    target_name = target_user.get("name", "") if target_user else ""

    if decision == "approve":
        role = ver.get("requested_role", "user")
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"role": role, "role_approved_at": now, "verification_status": "approved"}},
        )
        await db.role_requests.update_one(
            {"user_id": user_id, "status": "pending"},
            {"$set": {"status": "approved", "assigned_role": role, "decided_at": now}},
        )
    else:
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"verification_status": "rejected"}},
        )
        await db.role_requests.update_one(
            {"user_id": user_id, "status": "pending"},
            {"$set": {"status": "rejected", "decided_at": now, "reason": reason}},
        )

    # Send KYC status email notification
    try:
        from core.email import send_kyc_status_email
        send_kyc_status_email(
            to=target_email,
            status="approved" if decision == "approve" else "rejected",
            user_name=target_name,
            rejection_reason=reason if decision == "reject" else ""
        )
        logger.info(f"KYC status email sent to {target_email}: {new_status}")
    except Exception as e:
        logger.error(f"Failed to send KYC status email: {e}")

    return {"ok": True, "decision": new_status, "user_id": user_id}
