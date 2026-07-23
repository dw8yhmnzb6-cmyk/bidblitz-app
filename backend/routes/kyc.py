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

from core.config import TEST_MODE
from core.database import db
from core.security import get_current_user
from services.kyc_ai_verifier import verify_id_documents, auto_decision

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/kyc", tags=["kyc"])

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "application/octet-stream", "binary/octet-stream"}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "heic", "heif"}
MAX_BYTES = 10 * 1024 * 1024  # 10MB per file
ALLOWED_DOC_TYPES = {"national_id", "passport", "driver_license", "drivers_license"}

UPLOAD_BASE = "/app/backend/uploads/kyc"
os.makedirs(UPLOAD_BASE, exist_ok=True)
MANUAL_REVIEW_THRESHOLD = 2

ISSUE_MESSAGE_MAP = {
    "front_too_high": "Die Vorderseite ist zu hoch fotografiert. Bitte mittig und vollständig aufnehmen.",
    "front_too_low": "Die Vorderseite ist zu niedrig fotografiert. Bitte etwas höher und vollständig aufnehmen.",
    "front_too_close": "Die Vorderseite ist zu nah am Rand. Bitte etwas mehr Abstand lassen.",
    "front_too_far": "Die Vorderseite ist zu klein im Bild. Bitte näher herangehen.",
    "front_cropped": "Die Vorderseite ist abgeschnitten. Alle vier Ecken müssen sichtbar sein.",
    "front_tilted": "Die Vorderseite ist schief. Bitte den Ausweis gerade ausrichten.",
    "front_blurry": "Die Vorderseite ist unscharf. Bitte das Foto ruhiger und schärfer aufnehmen.",
    "front_glare": "Auf der Vorderseite gibt es Spiegelungen. Bitte ohne Blitz oder Reflexion neu fotografieren.",
    "front_dark": "Die Vorderseite ist zu dunkel. Bitte bei besserem Licht neu fotografieren.",
    "front_text_unreadable": "Die Schrift auf der Vorderseite ist nicht gut lesbar. Bitte das Foto schärfer aufnehmen.",
    "back_too_high": "Die Rückseite ist zu hoch fotografiert. Bitte mittig und vollständig aufnehmen.",
    "back_too_low": "Die Rückseite ist zu niedrig fotografiert. Bitte etwas höher und vollständig aufnehmen.",
    "back_too_close": "Die Rückseite ist zu nah am Rand. Bitte etwas mehr Abstand lassen.",
    "back_too_far": "Die Rückseite ist zu klein im Bild. Bitte näher herangehen.",
    "back_cropped": "Die Rückseite ist abgeschnitten. Alle vier Ecken müssen sichtbar sein.",
    "back_tilted": "Die Rückseite ist schief. Bitte den Ausweis gerade ausrichten.",
    "back_blurry": "Die Rückseite ist unscharf. Bitte das Foto ruhiger und schärfer aufnehmen.",
    "back_glare": "Auf der Rückseite gibt es Spiegelungen. Bitte ohne Blitz oder Reflexion neu fotografieren.",
    "back_dark": "Die Rückseite ist zu dunkel. Bitte bei besserem Licht neu fotografieren.",
    "back_text_unreadable": "Die Schrift auf der Rückseite ist nicht gut lesbar. Bitte das Foto schärfer aufnehmen.",
    "back_mrz_unreadable": "Der maschinenlesbare Bereich auf der Rückseite ist nicht klar lesbar.",
    "selfie_too_high": "Das Selfie ist zu hoch aufgenommen. Bitte Gesicht und Ausweis mittig halten.",
    "selfie_too_low": "Das Selfie ist zu niedrig aufgenommen. Bitte Gesicht und Ausweis mittig halten.",
    "selfie_too_close": "Das Selfie ist zu nah. Bitte etwas mehr Abstand lassen, damit Gesicht und Ausweis vollständig sichtbar sind.",
    "selfie_too_far": "Das Selfie ist zu weit weg. Bitte näher herangehen, damit Gesicht und Ausweis klar sichtbar sind.",
    "selfie_cropped": "Auf dem Selfie ist etwas abgeschnitten. Gesicht und Ausweis müssen vollständig sichtbar sein.",
    "selfie_tilted": "Das Selfie ist schief. Bitte Kamera gerade halten.",
    "selfie_blurry": "Das Selfie ist unscharf. Bitte ruhiger halten und neu aufnehmen.",
    "selfie_glare": "Auf dem Selfie gibt es Spiegelungen auf dem Ausweis. Bitte ohne Reflexion neu aufnehmen.",
    "selfie_dark": "Das Selfie ist zu dunkel. Bitte bei hellerem Licht neu aufnehmen.",
    "selfie_face_not_clear": "Dein Gesicht ist auf dem Selfie nicht klar erkennbar.",
    "selfie_document_not_visible": "Der Ausweis ist auf dem Selfie nicht klar sichtbar. Bitte den Ausweis neben dein Gesicht halten.",
    "selfie_multiple_faces": "Auf dem Selfie wurden mehrere Gesichter erkannt. Bitte nur alleine im Bild sein.",
    "document_not_real": "Das hochgeladene Dokument wirkt nicht wie ein gültiger amtlicher Ausweis.",
    "document_expired": "Der Ausweis ist abgelaufen. Bitte ein gültiges Dokument hochladen.",
    "document_mismatch": "Vorder- und Rückseite scheinen nicht zum gleichen Dokument zu gehören.",
    "selfie_holds_document_failed": "Auf dem Selfie ist nicht klar erkennbar, dass du den Ausweis in der Hand hältst.",
    "face_mismatch": "Das Selfie passt nicht ausreichend zum Foto auf dem Ausweis.",
    "fraud_signal": "Die Prüfung hat Auffälligkeiten erkannt. Bitte verwende unveränderte Originalfotos.",
}


# ─── Models ──────────────────────────────────────────────────────
class KYCStatusResponse(BaseModel):
    kyc_verified: bool
    kyc_status: str
    document_type: Optional[str] = None
    submitted_at: Optional[str] = None
    reviewed_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    ai_confidence: Optional[int] = None
    failure_reasons: Optional[list[str]] = None
    user_feedback: Optional[list[str]] = None
    failed_attempts: Optional[int] = 0
    can_request_manual_review: Optional[bool] = False
    manual_review_requested: Optional[bool] = False
    manual_review_requested_at: Optional[str] = None
    can_use_features: dict


# ─── Helpers ─────────────────────────────────────────────────────
def _capabilities(kyc_status: str) -> dict:
    """What can a user do based on their KYC status?"""
    verified = kyc_status in {"approved", "verified"}
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
    content_type = (uf.content_type or "").lower()
    filename = (uf.filename or "").lower()
    extension = filename.rsplit(".", 1)[-1] if "." in filename else ""
    if content_type in ALLOWED_TYPES and (content_type not in {"application/octet-stream", "binary/octet-stream"} or extension in ALLOWED_EXTENSIONS):
        return
    if extension in ALLOWED_EXTENSIONS and content_type in {"", "application/octet-stream", "binary/octet-stream"}:
        return
    raise HTTPException(status_code=400, detail=f"Ungültiger Dateityp für {label} (JPG/PNG/WebP/HEIC/HEIF)")


def _normalize_kyc_status(user: dict) -> tuple[str, bool]:
    raw_status = str(user.get("kyc_status") or "not_started").strip().lower()
    if raw_status == "verified":
        return "approved", True
    if raw_status in {"failed", "error"}:
        return "rejected", False
    if raw_status == "approved":
        return "approved", True
    return raw_status, bool(user.get("kyc_verified"))


def _as_issue_list(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def _normalize_issue_code(slot: str, code: str) -> str:
    normalized = str(code or "").strip().lower().replace("-", "_").replace(" ", "_")
    if not normalized or normalized == "ok":
        return ""
    return normalized if normalized.startswith(f"{slot}_") else f"{slot}_{normalized}"


def _push_feedback(failure_reasons: list[str], user_feedback: list[str], code: str, custom_message: Optional[str] = None):
    if not code:
        return
    if code not in failure_reasons:
        failure_reasons.append(code)
    message = (custom_message or ISSUE_MESSAGE_MAP.get(code) or "").strip()
    if message and message not in user_feedback:
        user_feedback.append(message)


def _build_feedback_from_verdict(verdict: dict) -> dict:
    failure_reasons: list[str] = []
    user_feedback: list[str] = []

    for slot in ("front", "back", "selfie"):
        for issue in _as_issue_list(verdict.get(f"{slot}_issues")):
            _push_feedback(failure_reasons, user_feedback, _normalize_issue_code(slot, issue))

    if not verdict.get("is_real_document", True):
        _push_feedback(failure_reasons, user_feedback, "document_not_real")
    if verdict.get("is_expired"):
        _push_feedback(failure_reasons, user_feedback, "document_expired")
    if verdict.get("back_matches_front") is False:
        _push_feedback(failure_reasons, user_feedback, "document_mismatch")
    if verdict.get("selfie_holds_document") is False:
        _push_feedback(failure_reasons, user_feedback, "selfie_holds_document_failed")
    if int(verdict.get("face_match_confidence", 0) or 0) < 50:
        _push_feedback(failure_reasons, user_feedback, "face_mismatch")
    if str(verdict.get("fraud_signals") or "").strip():
        _push_feedback(failure_reasons, user_feedback, "fraud_signal")

    if int(verdict.get("front_quality", 100) or 100) < 55 and not any(code.startswith("front_") for code in failure_reasons):
        _push_feedback(failure_reasons, user_feedback, "front_blurry")
    if int(verdict.get("back_quality", 100) or 100) < 55 and not any(code.startswith("back_") for code in failure_reasons):
        _push_feedback(failure_reasons, user_feedback, "back_blurry")

    for item in _as_issue_list(verdict.get("user_feedback")):
        if item not in user_feedback:
            user_feedback.append(item)

    summary = user_feedback[0] if user_feedback else ""
    return {
        "failure_reasons": failure_reasons,
        "user_feedback": user_feedback,
        "summary": summary,
    }


def _next_failed_attempts(previous_failed_attempts: int, decision: str) -> int:
    if decision == "rejected":
        return previous_failed_attempts + 1
    if decision == "approved":
        return 0
    return previous_failed_attempts


def _can_request_manual_review(failed_attempts: int, manual_review_requested: bool) -> bool:
    return failed_attempts >= MANUAL_REVIEW_THRESHOLD and not manual_review_requested


def _capability_status_for_response(actual_status: str) -> str:
    return "approved" if TEST_MODE else actual_status


async def _get_raw_current_user(request: Request) -> dict:
    auth_user = await get_current_user(request)
    raw_user = await db.users.find_one({"_id": auth_user["_id"]})
    if not raw_user:
        raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
    return raw_user


# ─── Endpoints ───────────────────────────────────────────────────
@router.get("/status", response_model=KYCStatusResponse)
async def get_kyc_status(request: Request):
    """Get user's KYC verification status + capabilities."""
    user = await _get_raw_current_user(request)
    kyc_status, kyc_verified = _normalize_kyc_status(user)
    capability_status = _capability_status_for_response(kyc_status)
    return KYCStatusResponse(
        kyc_verified=kyc_verified,
        kyc_status=kyc_status,
        document_type=user.get("kyc_document_type"),
        submitted_at=user.get("kyc_submitted_at"),
        reviewed_at=user.get("kyc_reviewed_at"),
        rejection_reason=user.get("kyc_rejection_reason") if kyc_status == "rejected" else None,
        ai_confidence=user.get("kyc_ai_confidence"),
        failure_reasons=user.get("kyc_failure_reasons") or [],
        user_feedback=user.get("kyc_user_feedback") or [],
        failed_attempts=int(user.get("kyc_failed_attempts", 0) or 0),
        can_request_manual_review=_can_request_manual_review(int(user.get("kyc_failed_attempts", 0) or 0), bool(user.get("kyc_manual_review_requested"))),
        manual_review_requested=bool(user.get("kyc_manual_review_requested")),
        manual_review_requested_at=user.get("kyc_manual_review_requested_at"),
        can_use_features=_capabilities(capability_status),
    )


@router.post("/submit")
async def submit_kyc(
    request: Request,
    id_front: UploadFile = File(..., description="Vorderseite Ausweis"),
    id_back: UploadFile = File(..., description="Rückseite Ausweis"),
    selfie: UploadFile = File(..., description="Selfie mit Ausweis in der Hand"),
    document_type: str = Form("national_id"),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    date_of_birth: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    id_number: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
):
    """
    Submit 3-photo KYC: ID front + ID back + selfie holding ID.
    Backend automatically runs Gemini Vision verification.
    Returns ai_verdict + final status (approved | pending | rejected).
    """
    user = await _get_raw_current_user(request)
    user_id = str(user["_id"])

    if document_type == "driver_license":
        document_type = "drivers_license"
    if document_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail="document_type must be one of: " + ", ".join(ALLOWED_DOC_TYPES))

    normalized_status, _normalized_verified = _normalize_kyc_status(user)
    if normalized_status == "approved":
        raise HTTPException(status_code=400, detail="KYC bereits verifiziert")
    if normalized_status == "pending":
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
            "kyc_declared_first_name": (first_name or "").strip() or None,
            "kyc_declared_last_name": (last_name or "").strip() or None,
            "kyc_declared_date_of_birth": (date_of_birth or "").strip() or None,
            "kyc_declared_country": (country or "").strip() or None,
            "kyc_declared_id_number": (id_number or "").strip() or None,
            "kyc_declared_address": (address or "").strip() or None,
        }},
    )

    # Run AI verification
    verdict = await verify_id_documents(front_path, back_path, selfie_path)
    decision = auto_decision(verdict)
    feedback = _build_feedback_from_verdict(verdict)
    previous_failed_attempts = int(user.get("kyc_failed_attempts", 0) or 0)
    failed_attempts = _next_failed_attempts(previous_failed_attempts, decision)
    manual_review_requested = bool(user.get("kyc_manual_review_requested"))
    can_request_manual_review = _can_request_manual_review(failed_attempts, manual_review_requested)

    update = {
        "kyc_ai_verdict": verdict,
        "kyc_ai_confidence": verdict.get("overall_confidence", 0),
        "kyc_ai_decision": decision,
        "kyc_extracted_name": verdict.get("full_name"),
        "kyc_extracted_dob": verdict.get("date_of_birth"),
        "kyc_extracted_doc_number": verdict.get("document_number"),
        "kyc_status": decision if decision != "pending" else "pending",
        "kyc_failure_reasons": feedback["failure_reasons"],
        "kyc_user_feedback": feedback["user_feedback"],
        "kyc_failed_attempts": failed_attempts,
        "kyc_manual_review_eligible": can_request_manual_review,
    }
    if decision == "approved":
        update["kyc_verified"] = True
        update["kyc_reviewed_at"] = now
        update["kyc_reviewed_by"] = "ai_auto"
        update["kyc_rejection_reason"] = None
        update["kyc_manual_review_requested"] = False
        update["kyc_manual_review_requested_at"] = None
    elif decision == "rejected":
        update["kyc_verified"] = False
        update["kyc_reviewed_at"] = now
        update["kyc_reviewed_by"] = "ai_auto"
        update["kyc_rejection_reason"] = feedback["summary"] or verdict.get("fraud_signals") or "AI-Prüfung fehlgeschlagen"
        update["kyc_manual_review_requested"] = False
        update["kyc_manual_review_requested_at"] = None
    else:
        update["kyc_verified"] = False
        update["kyc_rejection_reason"] = None

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
                "failure_reasons": feedback["failure_reasons"],
                "user_feedback": feedback["user_feedback"],
                "failed_attempts": failed_attempts,
                "manual_review_eligible": can_request_manual_review,
                "manual_review_requested": False,
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
        "failure_reasons": feedback["failure_reasons"],
        "user_feedback": feedback["user_feedback"],
        "failed_attempts": failed_attempts,
        "can_request_manual_review": can_request_manual_review,
        "manual_review_requested": False,
        "extracted": {
            "name": verdict.get("full_name"),
            "date_of_birth": verdict.get("date_of_birth"),
            "document_type": verdict.get("document_type"),
        },
        "message": (
            "Verifizierung erfolgreich!" if decision == "approved"
            else "Wir haben deine Dokumente erhalten und prüfen sie." if decision == "pending"
            else "Bitte korrigiere die markierten Punkte und lade die Bilder erneut hoch."
        ),
        "capabilities": _capabilities(_capability_status_for_response(decision if decision != "pending" else "pending")),
    }


@router.post("/manual-review/request")
async def request_manual_review(request: Request):
    user = await _get_raw_current_user(request)
    failed_attempts = int(user.get("kyc_failed_attempts", 0) or 0)
    if user.get("kyc_status") != "rejected":
        raise HTTPException(status_code=400, detail="Manuelle Prüfung ist erst nach einer abgelehnten automatischen Prüfung möglich.")
    if failed_attempts < MANUAL_REVIEW_THRESHOLD:
        raise HTTPException(status_code=400, detail=f"Manuelle Prüfung ist erst nach {MANUAL_REVIEW_THRESHOLD} Fehlversuchen möglich.")
    if user.get("kyc_manual_review_requested"):
        raise HTTPException(status_code=400, detail="Manuelle Prüfung wurde bereits angefordert.")

    now = datetime.now(timezone.utc).isoformat()
    user_id = str(user["_id"])
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "kyc_status": "pending",
            "kyc_verified": False,
            "kyc_manual_review_requested": True,
            "kyc_manual_review_requested_at": now,
            "kyc_manual_review_eligible": False,
        }},
    )
    await db.kyc_reviews.update_many(
        {"user_id": user_id},
        {"$set": {"manual_review_requested": True, "manual_review_requested_at": now, "status": "manual_review_requested"}},
    )
    return {
        "ok": True,
        "status": "pending",
        "manual_review_requested": True,
        "message": "Deine manuelle Prüfung wurde angefordert. Ein Admin prüft deine Unterlagen jetzt persönlich.",
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
    if status in (None, "all"):
        query = {}
    elif status == "pending":
        query = {"status": {"$in": ["pending", "manual_review_requested"]}}
    else:
        query = {"status": status}
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
        "kyc_manual_review_requested": False,
        "kyc_manual_review_requested_at": None,
        "kyc_manual_review_eligible": False,
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
    if TEST_MODE:
        return user
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
