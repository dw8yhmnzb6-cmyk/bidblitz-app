"""
Credit System - Kredit-System für BidBlitz Pay
Nutzer können Kredite beantragen mit Dokumenten-Upload
Admin genehmigt/ablehnt manuell
Inkl. Kredit-Score System für bessere Konditionen
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid
import os
import base64

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/credit", tags=["Credit System"])

# Constants
MIN_CREDIT_AMOUNT = 50
MAX_CREDIT_AMOUNT = 2000
MIN_INTEREST_RATE = 1.5  # 1.5% per month (for Diamond tier)
MAX_INTEREST_RATE = 5  # 5% per month
NO_INTEREST_THRESHOLD = 50  # No interest for amounts under €50
MIN_REPAYMENT_MONTHS = 3
MAX_REPAYMENT_MONTHS = 6

UPLOAD_DIR = "/app/backend/uploads/credit_documents"

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ==================== CREDIT SCORE SYSTEM ====================

# Score Constants
INITIAL_SCORE = 500
MIN_SCORE = 0
MAX_SCORE = 1000

# Score Tiers with benefits
SCORE_TIERS = {
    "red": {
        "name": "Rot",
        "name_en": "Red",
        "min_score": 0,
        "max_score": 300,
        "max_credit": 0,  # No credit allowed
        "interest_rate": 5.0,
        "color": "#EF4444",
        "icon": "🔴"
    },
    "yellow": {
        "name": "Gelb",
        "name_en": "Yellow",
        "min_score": 301,
        "max_score": 500,
        "max_credit": 500,
        "interest_rate": 5.0,
        "color": "#EAB308",
        "icon": "🟡"
    },
    "green": {
        "name": "Grün",
        "name_en": "Green",
        "min_score": 501,
        "max_score": 700,
        "max_credit": 1500,
        "interest_rate": 3.0,
        "color": "#22C55E",
        "icon": "🟢"
    },
    "gold": {
        "name": "Gold",
        "name_en": "Gold",
        "min_score": 701,
        "max_score": 900,
        "max_credit": 2000,
        "interest_rate": 2.0,
        "color": "#F59E0B",
        "icon": "⭐"
    },
    "diamond": {
        "name": "Diamant",
        "name_en": "Diamond",
        "min_score": 901,
        "max_score": 1000,
        "max_credit": 2000,  # Still max €2000 as requested
        "interest_rate": 1.5,
        "color": "#06B6D4",
        "icon": "💎"
    }
}

# Score change events
SCORE_EVENTS = {
    "on_time_payment": 20,      # Pünktliche Zahlung
    "early_payment": 30,        # Frühe Zahlung (vor Fälligkeit)
    "full_repayment": 100,      # Vollständige Rückzahlung
    "late_payment": -30,        # Verspätete Zahlung
    "very_late_payment": -50,   # Sehr verspätete Zahlung (>7 Tage)
    "missed_payment": -100,     # Verpasste Zahlung
    "first_credit_completed": 50,  # Erster Kredit erfolgreich zurückgezahlt
    "account_verification": 25,    # Konto verifiziert
}


def get_tier_for_score(score: int) -> dict:
    """Get the tier information for a given score"""
    for tier_key, tier in SCORE_TIERS.items():
        if tier["min_score"] <= score <= tier["max_score"]:
            return {**tier, "key": tier_key}
    return {**SCORE_TIERS["red"], "key": "red"}


def get_next_tier(current_score: int) -> Optional[dict]:
    """Get the next tier the user can achieve"""
    current_tier = get_tier_for_score(current_score)
    tier_order = ["red", "yellow", "green", "gold", "diamond"]
    current_idx = tier_order.index(current_tier["key"])
    
    if current_idx < len(tier_order) - 1:
        next_tier_key = tier_order[current_idx + 1]
        next_tier = SCORE_TIERS[next_tier_key]
        return {
            **next_tier,
            "key": next_tier_key,
            "points_needed": next_tier["min_score"] - current_score
        }
    return None


async def get_user_credit_score(user_id: str) -> dict:
    """Get or create a user's credit score"""
    score_doc = await db.credit_scores.find_one({"user_id": user_id})
    
    if not score_doc:
        # Create initial score
        score_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "score": INITIAL_SCORE,
            "history": [{
                "event": "account_created",
                "change": 0,
                "score_after": INITIAL_SCORE,
                "date": datetime.now(timezone.utc).isoformat(),
                "description": "Konto erstellt - Startscore"
            }],
            "total_credits_completed": 0,
            "total_on_time_payments": 0,
            "total_late_payments": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.credit_scores.insert_one(score_doc)
    
    return score_doc


async def update_credit_score(user_id: str, event: str, description: str = None) -> dict:
    """Update a user's credit score based on an event"""
    if event not in SCORE_EVENTS:
        return None
    
    change = SCORE_EVENTS[event]
    score_doc = await get_user_credit_score(user_id)
    
    current_score = score_doc.get("score", INITIAL_SCORE)
    new_score = max(MIN_SCORE, min(MAX_SCORE, current_score + change))
    
    history_entry = {
        "event": event,
        "change": change,
        "score_before": current_score,
        "score_after": new_score,
        "date": datetime.now(timezone.utc).isoformat(),
        "description": description or event
    }
    
    # Update stats based on event type
    update_fields = {
        "score": new_score,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if event in ["on_time_payment", "early_payment"]:
        update_fields["total_on_time_payments"] = score_doc.get("total_on_time_payments", 0) + 1
    elif event in ["late_payment", "very_late_payment", "missed_payment"]:
        update_fields["total_late_payments"] = score_doc.get("total_late_payments", 0) + 1
    elif event in ["full_repayment", "first_credit_completed"]:
        update_fields["total_credits_completed"] = score_doc.get("total_credits_completed", 0) + 1
    
    await db.credit_scores.update_one(
        {"user_id": user_id},
        {
            "$set": update_fields,
            "$push": {"history": {"$each": [history_entry], "$slice": -50}}  # Keep last 50 entries
        }
    )
    
    logger.info(f"Credit score updated for user {user_id}: {current_score} -> {new_score} ({event})")
    
    return {
        "previous_score": current_score,
        "new_score": new_score,
        "change": change,
        "event": event
    }


class CreditApplication(BaseModel):
    amount: float
    repayment_months: int = 3
    purpose: Optional[str] = None


class CreditRepayment(BaseModel):
    credit_id: str
    amount: float


class AdminCreditDecision(BaseModel):
    credit_id: str
    approved: bool
    interest_rate: float = 3.0  # Default 3%
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


# ==================== USER ENDPOINTS ====================

@router.get("/score")
async def get_credit_score(user: dict = Depends(get_current_user)):
    """Holt den Kredit-Score des Nutzers mit allen Details"""
    user_id = user["id"]
    
    score_doc = await get_user_credit_score(user_id)
    current_score = score_doc.get("score", INITIAL_SCORE)
    current_tier = get_tier_for_score(current_score)
    next_tier = get_next_tier(current_score)
    
    # Calculate progress to next tier
    progress_percent = 0
    if next_tier:
        tier_range = current_tier["max_score"] - current_tier["min_score"]
        progress_in_tier = current_score - current_tier["min_score"]
        progress_percent = int((progress_in_tier / tier_range) * 100) if tier_range > 0 else 0
    
    return {
        "score": current_score,
        "tier": {
            "key": current_tier["key"],
            "name": current_tier["name"],
            "name_en": current_tier["name_en"],
            "icon": current_tier["icon"],
            "color": current_tier["color"],
            "max_credit": current_tier["max_credit"],
            "interest_rate": current_tier["interest_rate"]
        },
        "next_tier": {
            "key": next_tier["key"],
            "name": next_tier["name"],
            "name_en": next_tier["name_en"],
            "icon": next_tier["icon"],
            "points_needed": next_tier["points_needed"],
            "max_credit": next_tier["max_credit"],
            "interest_rate": next_tier["interest_rate"]
        } if next_tier else None,
        "progress_percent": progress_percent,
        "stats": {
            "total_credits_completed": score_doc.get("total_credits_completed", 0),
            "total_on_time_payments": score_doc.get("total_on_time_payments", 0),
            "total_late_payments": score_doc.get("total_late_payments", 0)
        },
        "history": score_doc.get("history", [])[-10:],  # Last 10 entries
        "tips": get_score_tips(current_score, current_tier["key"])
    }


def get_score_tips(score: int, tier_key: str) -> list:
    """Get tips to improve credit score"""
    tips = []
    
    if tier_key == "red":
        tips.append({
            "title": "Konto verifizieren",
            "description": "Verifizieren Sie Ihr Konto für +25 Punkte",
            "points": 25
        })
    
    if tier_key in ["red", "yellow"]:
        tips.append({
            "title": "Pünktlich zahlen",
            "description": "Jede pünktliche Zahlung bringt +20 Punkte",
            "points": 20
        })
        tips.append({
            "title": "Kredit vollständig zurückzahlen",
            "description": "Vollständige Rückzahlung bringt +100 Punkte",
            "points": 100
        })
    
    if tier_key in ["yellow", "green"]:
        tips.append({
            "title": "Früh zahlen",
            "description": "Zahlung vor Fälligkeit bringt +30 Punkte",
            "points": 30
        })
    
    if tier_key in ["green", "gold"]:
        tips.append({
            "title": "Regelmäßig Kredite nutzen",
            "description": "Jeder erfolgreich abgeschlossene Kredit verbessert Ihren Score",
            "points": 50
        })
    
    return tips


@router.get("/eligibility")
async def check_credit_eligibility(user: dict = Depends(get_current_user)):
    """Prüft, ob der Nutzer für einen Kredit berechtigt ist"""
    user_id = user["id"]
    
    # Check if user is verified
    user_data = await db.users.find_one({"id": user_id})
    if not user_data:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    is_verified = user_data.get("is_verified", False) or user_data.get("id_verified", False)
    
    # Check for existing open credit
    existing_credit = await db.credits.find_one({
        "user_id": user_id,
        "status": {"$in": ["pending", "approved", "active"]}
    })
    
    has_open_credit = existing_credit is not None
    
    # Get credit history
    credit_history = await db.credits.find({
        "user_id": user_id,
        "status": "repaid"
    }).to_list(100)
    
    # Get credit score and tier
    score_doc = await get_user_credit_score(user_id)
    current_score = score_doc.get("score", INITIAL_SCORE)
    current_tier = get_tier_for_score(current_score)
    
    # Determine max credit based on tier (but capped at MAX_CREDIT_AMOUNT)
    tier_max_credit = min(current_tier["max_credit"], MAX_CREDIT_AMOUNT)
    tier_interest_rate = current_tier["interest_rate"]
    
    # Check if eligible based on score tier
    score_eligible = current_tier["max_credit"] > 0
    
    return {
        "eligible": is_verified and not has_open_credit and score_eligible,
        "is_verified": is_verified,
        "has_open_credit": has_open_credit,
        "open_credit_id": existing_credit["id"] if existing_credit else None,
        "credit_history_count": len(credit_history),
        "min_amount": MIN_CREDIT_AMOUNT,
        "max_amount": tier_max_credit,
        "interest_rate": tier_interest_rate,
        "interest_rate_range": f"{MIN_INTEREST_RATE}-{MAX_INTEREST_RATE}%",
        "repayment_months_range": f"{MIN_REPAYMENT_MONTHS}-{MAX_REPAYMENT_MONTHS}",
        "score": current_score,
        "tier": {
            "key": current_tier["key"],
            "name": current_tier["name"],
            "icon": current_tier["icon"],
            "color": current_tier["color"]
        },
        "score_eligible": score_eligible,
        "score_message": "Ihr Score ist zu niedrig für einen Kredit. Verbessern Sie ihn durch pünktliche Zahlungen." if not score_eligible else None
    }


@router.post("/apply")
async def apply_for_credit(
    amount: float = Form(...),
    repayment_months: int = Form(...),
    purpose: str = Form(None),
    id_front: UploadFile = File(...),
    id_back: UploadFile = File(...),
    selfie_with_id: UploadFile = File(...),
    income_proof_1: UploadFile = File(...),
    income_proof_2: UploadFile = File(...),
    income_proof_3: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Kredit beantragen mit Dokumenten-Upload"""
    user_id = user["id"]
    
    # Validate amount
    if amount < MIN_CREDIT_AMOUNT or amount > MAX_CREDIT_AMOUNT:
        raise HTTPException(
            status_code=400, 
            detail=f"Kreditbetrag muss zwischen €{MIN_CREDIT_AMOUNT} und €{MAX_CREDIT_AMOUNT} liegen"
        )
    
    # Validate repayment months
    if repayment_months < MIN_REPAYMENT_MONTHS or repayment_months > MAX_REPAYMENT_MONTHS:
        raise HTTPException(
            status_code=400,
            detail=f"Rückzahlungszeitraum muss zwischen {MIN_REPAYMENT_MONTHS} und {MAX_REPAYMENT_MONTHS} Monaten liegen"
        )
    
    # Check eligibility
    user_data = await db.users.find_one({"id": user_id})
    is_verified = user_data.get("is_verified", False) or user_data.get("id_verified", False)
    
    if not is_verified:
        raise HTTPException(status_code=403, detail="Nur verifizierte Nutzer können Kredite beantragen")
    
    # Check for existing credit
    existing_credit = await db.credits.find_one({
        "user_id": user_id,
        "status": {"$in": ["pending", "approved", "active"]}
    })
    
    if existing_credit:
        raise HTTPException(
            status_code=400, 
            detail="Sie haben bereits einen offenen Kredit. Bitte zuerst zurückzahlen."
        )
    
    # Generate credit ID
    credit_id = str(uuid.uuid4())
    user_folder = f"{UPLOAD_DIR}/{user_id}/{credit_id}"
    os.makedirs(user_folder, exist_ok=True)
    
    # Save documents
    documents = {}
    
    async def save_file(file: UploadFile, name: str) -> str:
        content = await file.read()
        ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filepath = f"{user_folder}/{name}.{ext}"
        with open(filepath, 'wb') as f:
            f.write(content)
        return filepath
    
    documents["id_front"] = await save_file(id_front, "id_front")
    documents["id_back"] = await save_file(id_back, "id_back")
    documents["selfie_with_id"] = await save_file(selfie_with_id, "selfie_with_id")
    documents["income_proof_1"] = await save_file(income_proof_1, "income_proof_1")
    documents["income_proof_2"] = await save_file(income_proof_2, "income_proof_2")
    documents["income_proof_3"] = await save_file(income_proof_3, "income_proof_3")
    
    # Create credit application
    credit_application = {
        "id": credit_id,
        "user_id": user_id,
        "user_email": user.get("email"),
        "user_name": user.get("name", user.get("username")),
        "amount": amount,
        "repayment_months": repayment_months,
        "purpose": purpose,
        "documents": documents,
        "status": "pending",  # pending, approved, rejected, active, repaid, defaulted
        "interest_rate": None,  # Set by admin
        "monthly_payment": None,
        "total_repayment": None,
        "amount_repaid": 0,
        "next_payment_date": None,
        "payments": [],
        "admin_notes": None,
        "rejection_reason": None,
        "approved_by": None,
        "approved_at": None,
        "activated_at": None,
        "repaid_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.credits.insert_one(credit_application)
    
    # Log application
    await db.credit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "credit_id": credit_id,
        "user_id": user_id,
        "action": "application_submitted",
        "details": {"amount": amount, "repayment_months": repayment_months},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Credit application submitted: {credit_id} by user {user_id} for €{amount}")
    
    return {
        "success": True,
        "message": "Kreditantrag erfolgreich eingereicht. Sie werden benachrichtigt, sobald die Prüfung abgeschlossen ist.",
        "credit_id": credit_id,
        "status": "pending",
        "amount": amount,
        "repayment_months": repayment_months
    }


@router.get("/my-credits")
async def get_my_credits(user: dict = Depends(get_current_user)):
    """Alle Kredite des Nutzers abrufen"""
    credits = await db.credits.find(
        {"user_id": user["id"]},
        {"_id": 0, "documents": 0}  # Exclude documents for security
    ).sort("created_at", -1).to_list(50)
    
    return {
        "credits": credits,
        "count": len(credits)
    }


@router.get("/my-credits/{credit_id}")
async def get_credit_details(credit_id: str, user: dict = Depends(get_current_user)):
    """Details eines Kredits abrufen"""
    credit = await db.credits.find_one(
        {"id": credit_id, "user_id": user["id"]},
        {"_id": 0, "documents": 0}
    )
    
    if not credit:
        raise HTTPException(status_code=404, detail="Kredit nicht gefunden")
    
    # Calculate remaining amount
    remaining = credit["amount"] + (credit.get("total_interest", 0) or 0) - credit.get("amount_repaid", 0)
    
    return {
        **credit,
        "remaining_amount": max(0, remaining),
        "is_fully_repaid": remaining <= 0
    }


@router.post("/repay")
async def repay_credit(data: CreditRepayment, user: dict = Depends(get_current_user)):
    """Kredit-Rückzahlung"""
    credit = await db.credits.find_one({
        "id": data.credit_id,
        "user_id": user["id"],
        "status": "active"
    })
    
    if not credit:
        raise HTTPException(status_code=404, detail="Aktiver Kredit nicht gefunden")
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Betrag")
    
    # Check wallet balance
    wallet = await db.wallets.find_one({"user_id": user["id"]})
    if not wallet or wallet.get("balance", 0) < data.amount:
        raise HTTPException(status_code=400, detail="Nicht genügend Guthaben in der Wallet")
    
    # Calculate remaining
    total_due = credit["amount"] + credit.get("total_interest", 0)
    already_paid = credit.get("amount_repaid", 0)
    remaining = total_due - already_paid
    
    # Limit payment to remaining amount
    actual_payment = min(data.amount, remaining)
    
    # Deduct from wallet
    await db.wallets.update_one(
        {"user_id": user["id"]},
        {"$inc": {"balance": -actual_payment}}
    )
    
    # Update credit
    new_amount_repaid = already_paid + actual_payment
    is_fully_repaid = new_amount_repaid >= total_due
    
    payment_record = {
        "id": str(uuid.uuid4()),
        "amount": actual_payment,
        "date": datetime.now(timezone.utc).isoformat(),
        "remaining_after": max(0, remaining - actual_payment)
    }
    
    update_data = {
        "amount_repaid": new_amount_repaid,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if is_fully_repaid:
        update_data["status"] = "repaid"
        update_data["repaid_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.credits.update_one(
        {"id": data.credit_id},
        {
            "$set": update_data,
            "$push": {"payments": payment_record}
        }
    )
    
    # Log payment
    await db.credit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "credit_id": data.credit_id,
        "user_id": user["id"],
        "action": "payment_made",
        "details": {"amount": actual_payment, "fully_repaid": is_fully_repaid},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create wallet transaction
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "credit_repayment",
        "amount": -actual_payment,
        "description": f"Kredit-Rückzahlung ({data.credit_id[:8]})",
        "credit_id": data.credit_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Credit payment: {data.credit_id} - €{actual_payment} by user {user['id']}")
    
    return {
        "success": True,
        "message": "Vollständig zurückgezahlt!" if is_fully_repaid else "Zahlung erfolgreich",
        "amount_paid": actual_payment,
        "total_repaid": new_amount_repaid,
        "remaining": max(0, total_due - new_amount_repaid),
        "is_fully_repaid": is_fully_repaid
    }


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/applications")
async def admin_get_credit_applications(status: str = None):
    """Admin: Alle Kreditanträge abrufen"""
    query = {}
    if status:
        query["status"] = status
    
    applications = await db.credits.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    # Count by status
    status_counts = {
        "pending": await db.credits.count_documents({"status": "pending"}),
        "approved": await db.credits.count_documents({"status": "approved"}),
        "active": await db.credits.count_documents({"status": "active"}),
        "repaid": await db.credits.count_documents({"status": "repaid"}),
        "rejected": await db.credits.count_documents({"status": "rejected"}),
        "defaulted": await db.credits.count_documents({"status": "defaulted"})
    }
    
    return {
        "applications": applications,
        "total": len(applications),
        "status_counts": status_counts
    }


@router.get("/admin/application/{credit_id}")
async def admin_get_credit_details(credit_id: str):
    """Admin: Kreditantrag-Details mit Dokumenten abrufen"""
    credit = await db.credits.find_one({"id": credit_id}, {"_id": 0})
    
    if not credit:
        raise HTTPException(status_code=404, detail="Kreditantrag nicht gefunden")
    
    # Get user details
    user = await db.users.find_one(
        {"id": credit["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    # Get logs
    logs = await db.credit_logs.find(
        {"credit_id": credit_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "credit": credit,
        "user": user,
        "logs": logs
    }


@router.get("/admin/document/{credit_id}/{doc_type}")
async def admin_get_document(credit_id: str, doc_type: str):
    """Admin: Dokument als Base64 abrufen"""
    credit = await db.credits.find_one({"id": credit_id})
    
    if not credit:
        raise HTTPException(status_code=404, detail="Kreditantrag nicht gefunden")
    
    documents = credit.get("documents", {})
    if doc_type not in documents:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    filepath = documents[doc_type]
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    
    with open(filepath, "rb") as f:
        content = f.read()
    
    # Determine content type
    ext = filepath.split('.')[-1].lower()
    content_type = "image/jpeg"
    if ext == "png":
        content_type = "image/png"
    elif ext == "pdf":
        content_type = "application/pdf"
    elif ext == "webp":
        content_type = "image/webp"
    
    return {
        "content": base64.b64encode(content).decode(),
        "content_type": content_type,
        "filename": f"{doc_type}.{ext}"
    }


@router.post("/admin/decide")
async def admin_decide_credit(data: AdminCreditDecision):
    """Admin: Kreditantrag genehmigen oder ablehnen"""
    credit = await db.credits.find_one({"id": data.credit_id})
    
    if not credit:
        raise HTTPException(status_code=404, detail="Kreditantrag nicht gefunden")
    
    if credit["status"] != "pending":
        raise HTTPException(status_code=400, detail="Kreditantrag wurde bereits bearbeitet")
    
    if data.approved:
        # Validate interest rate
        if data.interest_rate < MIN_INTEREST_RATE or data.interest_rate > MAX_INTEREST_RATE:
            raise HTTPException(
                status_code=400,
                detail=f"Zinssatz muss zwischen {MIN_INTEREST_RATE}% und {MAX_INTEREST_RATE}% liegen"
            )
        
        # Calculate repayment details
        amount = credit["amount"]
        months = credit["repayment_months"]
        
        # Apply interest (no interest for amounts under threshold)
        if amount < NO_INTEREST_THRESHOLD:
            total_interest = 0
            interest_rate = 0
        else:
            total_interest = amount * (data.interest_rate / 100) * months
            interest_rate = data.interest_rate
        
        total_repayment = amount + total_interest
        monthly_payment = total_repayment / months
        
        # Set first payment date (30 days from now)
        next_payment_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        
        await db.credits.update_one(
            {"id": data.credit_id},
            {
                "$set": {
                    "status": "approved",
                    "interest_rate": interest_rate,
                    "total_interest": total_interest,
                    "total_repayment": total_repayment,
                    "monthly_payment": monthly_payment,
                    "next_payment_date": next_payment_date,
                    "admin_notes": data.notes,
                    "approved_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        message = f"Kredit genehmigt: €{amount} mit {interest_rate}% Zinsen"
        
    else:
        await db.credits.update_one(
            {"id": data.credit_id},
            {
                "$set": {
                    "status": "rejected",
                    "rejection_reason": data.rejection_reason,
                    "admin_notes": data.notes,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        message = f"Kredit abgelehnt: {data.rejection_reason or 'Kein Grund angegeben'}"
    
    # Log decision
    await db.credit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "credit_id": data.credit_id,
        "user_id": credit["user_id"],
        "action": "approved" if data.approved else "rejected",
        "details": {
            "interest_rate": data.interest_rate if data.approved else None,
            "rejection_reason": data.rejection_reason if not data.approved else None
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Credit decision: {data.credit_id} - {'approved' if data.approved else 'rejected'}")
    
    return {
        "success": True,
        "message": message,
        "status": "approved" if data.approved else "rejected"
    }


@router.post("/admin/activate/{credit_id}")
async def admin_activate_credit(credit_id: str):
    """Admin: Genehmigten Kredit aktivieren (Geld auszahlen)"""
    credit = await db.credits.find_one({"id": credit_id})
    
    if not credit:
        raise HTTPException(status_code=404, detail="Kredit nicht gefunden")
    
    if credit["status"] != "approved":
        raise HTTPException(status_code=400, detail="Kredit muss zuerst genehmigt werden")
    
    user_id = credit["user_id"]
    amount = credit["amount"]
    
    # Add credit amount to user's wallet
    wallet = await db.wallets.find_one({"user_id": user_id})
    
    if wallet:
        await db.wallets.update_one(
            {"user_id": user_id},
            {"$inc": {"balance": amount}}
        )
    else:
        await db.wallets.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "balance": amount,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Update credit status
    await db.credits.update_one(
        {"id": credit_id},
        {
            "$set": {
                "status": "active",
                "activated_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Create wallet transaction
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "credit_disbursement",
        "amount": amount,
        "description": f"Kredit ausgezahlt ({credit_id[:8]})",
        "credit_id": credit_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Log activation
    await db.credit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "credit_id": credit_id,
        "user_id": user_id,
        "action": "activated",
        "details": {"amount_disbursed": amount},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Credit activated: {credit_id} - €{amount} disbursed to user {user_id}")
    
    return {
        "success": True,
        "message": f"€{amount} wurde auf das Wallet des Nutzers überwiesen",
        "amount": amount,
        "status": "active"
    }


@router.post("/admin/extend/{credit_id}")
async def admin_extend_credit(credit_id: str, extra_days: int = 30):
    """Admin: Kreditfrist verlängern (für kleine Beträge)"""
    credit = await db.credits.find_one({"id": credit_id})
    
    if not credit:
        raise HTTPException(status_code=404, detail="Kredit nicht gefunden")
    
    if credit["status"] != "active":
        raise HTTPException(status_code=400, detail="Nur aktive Kredite können verlängert werden")
    
    # Calculate new payment date
    current_date = datetime.fromisoformat(credit["next_payment_date"].replace('Z', '+00:00'))
    new_date = current_date + timedelta(days=extra_days)
    
    await db.credits.update_one(
        {"id": credit_id},
        {
            "$set": {
                "next_payment_date": new_date.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "extensions": {
                    "date": datetime.now(timezone.utc).isoformat(),
                    "days": extra_days,
                    "new_due_date": new_date.isoformat()
                }
            }
        }
    )
    
    # Log extension
    await db.credit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "credit_id": credit_id,
        "user_id": credit["user_id"],
        "action": "extended",
        "details": {"extra_days": extra_days, "new_date": new_date.isoformat()},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Credit extended: {credit_id} by {extra_days} days")
    
    return {
        "success": True,
        "message": f"Frist um {extra_days} Tage verlängert",
        "new_payment_date": new_date.isoformat()
    }


@router.get("/admin/stats")
async def admin_get_credit_stats():
    """Admin: Kredit-Statistiken"""
    # Get totals
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "total_repaid": {"$sum": "$amount_repaid"}
        }}
    ]
    
    stats_by_status = await db.credits.aggregate(pipeline).to_list(10)
    
    # Calculate overall stats
    total_outstanding = await db.credits.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {
            "_id": None,
            "total": {"$sum": {"$subtract": [
                {"$add": ["$amount", {"$ifNull": ["$total_interest", 0]}]},
                {"$ifNull": ["$amount_repaid", 0]}
            ]}}
        }}
    ]).to_list(1)
    
    return {
        "by_status": {s["_id"]: {"count": s["count"], "amount": s["total_amount"]} for s in stats_by_status},
        "total_outstanding": total_outstanding[0]["total"] if total_outstanding else 0,
        "pending_applications": await db.credits.count_documents({"status": "pending"})
    }
