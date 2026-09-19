"""
BidBlitz V2 - Wallet Credit System (BNPL)
Internes Kredit-System mit Credit Score (A/B/C Rating)

Score System:
- A (Grün): Guter Kunde, darf bis €100 Kredit nehmen
- B (Orange): Zu spät bezahlt, temporär kein Kredit
- C (Rot): Schwere Verletzung, 6 Monate Kredit-Sperre

Regeln:
- Kredit bis €100
- Rückzahlung innerhalb 30 Tagen
- Pünktliche Zahlung = Score bleibt A
- Zu spät (>7 Tage) = Abstufung auf B
- Sehr spät (>30 Tage) = Abstufung auf C, 6 Monate Sperre
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List
import secrets
import hashlib
import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
from core.payment_engine import transfer_between_wallets, TransactionType

router = APIRouter(prefix="/api/credit", tags=["credit"])

# ═══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

MAX_CREDIT_AMOUNT = 5000.00  # Maximum €5000 Kredit
REPAYMENT_DAYS = 30  # 30 Tage Rückzahlungsfrist
GRACE_PERIOD_DAYS = 7  # 7 Tage Kulanz bevor Abstufung
SCORE_C_BAN_MONTHS = 6  # 6 Monate Sperre bei Score C

CREDIT_SCORES = {
    "A": {"color": "#22C55E", "label": "Ausgezeichnet", "can_borrow": True, "max_amount": 5000.00},
    "B": {"color": "#F59E0B", "label": "Eingeschränkt", "can_borrow": True, "max_amount": 500.00},
    "C": {"color": "#EF4444", "label": "Gesperrt", "can_borrow": False, "max_amount": 0},
}

CREDIT_LIVE_ENABLED = TEST_MODE or os.environ.get("CREDIT_LIVE_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


def _require_credit_live() -> None:
    if not CREDIT_LIVE_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="BidBlitz Credit ist für Livebetrieb noch nicht freigeschaltet.",
        )


async def _credit_pool_user_id() -> Optional[str]:
    email = os.environ.get("CREDIT_POOL_EMAIL", "").strip().lower()
    if not email and TEST_MODE:
        email = "admin@bidblitz.ae"
    if not email:
        return None
    pool = await db.users.find_one({"email": email}, {"_id": 1})
    return str(pool["_id"]) if pool else None



# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class CreditRequest(BaseModel):
    amount: float = Field(..., gt=0, le=MAX_CREDIT_AMOUNT, description="Kreditbetrag in EUR")
    term_months: int = Field(default=6, ge=1, le=36, description="Laufzeit in Monaten")
    idempotency_key: str = Field(..., min_length=8, max_length=200)


class RepaymentRequest(BaseModel):
    credit_id: str
    amount: float = Field(..., gt=0, le=MAX_CREDIT_AMOUNT * 2)
    idempotency_key: str = Field(..., min_length=8, max_length=200)


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def get_user_credit_profile(user_id: str):
    """Get or create user's credit profile."""
    profile = await db.credit_profiles.find_one({"user_id": user_id})
    
    if not profile:
        # Create new profile with Score A
        profile = {
            "user_id": user_id,
            "score": "A",
            "score_updated_at": datetime.now(timezone.utc).isoformat(),
            "total_credits_taken": 0,
            "total_repaid": 0,
            "on_time_payments": 0,
            "late_payments": 0,
            "very_late_payments": 0,
            "current_debt": 0.0,
            "ban_until": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.credit_profiles.insert_one(profile)
        profile = await db.credit_profiles.find_one({"user_id": user_id})
    
    profile.pop("_id", None)
    return profile


async def update_credit_score(user_id: str, new_score: str, reason: str):
    """Update user's credit score."""
    now = datetime.now(timezone.utc)
    
    update_data = {
        "score": new_score,
        "score_updated_at": now.isoformat(),
        "last_score_change_reason": reason,
    }
    
    # If downgraded to C, set 6-month ban
    if new_score == "C":
        ban_until = now + timedelta(days=SCORE_C_BAN_MONTHS * 30)
        update_data["ban_until"] = ban_until.isoformat()
    
    await db.credit_profiles.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    # Log score change
    await db.credit_score_history.insert_one({
        "user_id": user_id,
        "old_score": None,  # Will be filled by caller if needed
        "new_score": new_score,
        "reason": reason,
        "timestamp": now.isoformat(),
    })


async def _record_credit_disbursement_profile_once(credit: dict) -> bool:
    marker = hashlib.sha256(f"credit-disbursement:{credit['credit_id']}".encode("utf-8")).hexdigest()[:24]
    field = f"disbursement_markers.{marker}"
    result = await db.credit_profiles.update_one(
        {"user_id": credit["user_id"], field: {"$exists": False}},
        {
            "$inc": {"current_debt": round(float(credit["amount"]), 2)},
            "$set": {
                field: {
                    "credit_id": credit["credit_id"],
                    "amount": round(float(credit["amount"]), 2),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
        upsert=True,
    )
    if result.modified_count == 1 or result.upserted_id is not None:
        return True
    profile = await db.credit_profiles.find_one(
        {"user_id": credit["user_id"], field: {"$exists": True}},
        {"_id": 1},
    )
    return bool(profile)


async def check_and_update_overdue_credits():
    """Background task: Check for overdue credits and update scores."""
    now = datetime.now(timezone.utc)
    
    # Find all active credits
    active_credits = await db.credits.find({"status": "active"}).to_list(1000)
    
    for credit in active_credits:
        due_date = datetime.fromisoformat(credit["due_date"].replace("Z", "+00:00"))
        user_id = credit["user_id"]
        
        days_overdue = (now - due_date).days
        
        if days_overdue > 30:
            # Very late - downgrade to C
            profile = await get_user_credit_profile(user_id)
            if profile["score"] != "C":
                await update_credit_score(user_id, "C", f"Kredit {credit['credit_id']} über 30 Tage überfällig")
                await db.credit_profiles.update_one(
                    {"user_id": user_id},
                    {"$inc": {"very_late_payments": 1}}
                )
        elif days_overdue > 7:
            # Late - downgrade to B
            profile = await get_user_credit_profile(user_id)
            if profile["score"] == "A":
                await update_credit_score(user_id, "B", f"Kredit {credit['credit_id']} über 7 Tage überfällig")
                await db.credit_profiles.update_one(
                    {"user_id": user_id},
                    {"$inc": {"late_payments": 1}}
                )


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
@router.get("/my-score")  # Alias for frontend
async def get_credit_status(request: Request):
    """Get user's credit status and score."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    profile = await get_user_credit_profile(user_id)
    score_info = CREDIT_SCORES.get(profile["score"], CREDIT_SCORES["A"])
    
    # Check if ban has expired
    if profile.get("ban_until"):
        ban_until = datetime.fromisoformat(profile["ban_until"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > ban_until:
            # Ban expired, upgrade to B
            await update_credit_score(user_id, "B", "Sperrzeit abgelaufen")
            profile["score"] = "B"
            profile["ban_until"] = None
            score_info = CREDIT_SCORES["B"]
    
    # Get active credits
    active_credits = await db.credits.find({
        "user_id": user_id,
        "status": "active"
    }).to_list(10)
    
    # Get pending credits
    pending_credits = await db.credits.find({
        "user_id": user_id,
        "status": "pending"
    }).to_list(10)
    
    for c in active_credits:
        c.pop("_id", None)
    for c in pending_credits:
        c.pop("_id", None)
    
    total_debt = sum(c.get("remaining_amount", 0) for c in active_credits)
    
    # Calculate available credit
    available_credit = max(0, score_info["max_amount"] - total_debt) if score_info["can_borrow"] else 0
    
    return {
        "score": profile["score"],
        "score_label": score_info["label"],
        "score_color": score_info["color"],
        "can_borrow": score_info["can_borrow"] and available_credit > 0 and len(pending_credits) == 0,
        "max_credit": score_info["max_amount"],
        "available_credit": round(available_credit, 2),
        "current_debt": round(total_debt, 2),
        "active_credit": round(total_debt, 2),
        "active_credits": active_credits,
        "pending_credits": pending_credits,
        "has_pending": len(pending_credits) > 0,
        "due_date": active_credits[0].get("due_date") if active_credits else None,
        "stats": {
            "total_credits": profile.get("total_credits_taken", 0),
            "on_time_payments": profile.get("on_time_payments", 0),
            "late_payments": profile.get("late_payments", 0),
        },
        "ban_until": profile.get("ban_until"),
    }


@router.post("/request")
@router.post("/apply")
async def request_credit(req: CreditRequest, request: Request):
    """Create one KYC-gated, retry-safe credit application."""
    _require_credit_live()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    if user.get("role") != "admin" and user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "kyc_required",
                "message": "KYC-Verifizierung erforderlich, bevor ein Kreditantrag gestellt werden kann.",
                "kyc_status": user.get("kyc_status", "not_started"),
            },
        )

    key = req.idempotency_key.strip()
    key_hash = hashlib.sha256(f"{user_id}:{key}".encode("utf-8")).hexdigest()[:20]
    credit_id = f"CR-{key_hash.upper()}"
    existing = await db.credits.find_one({"credit_id": credit_id, "user_id": user_id}, {"_id": 0})
    if existing:
        if round(float(existing.get("amount") or 0), 2) != round(float(req.amount), 2) or int(existing.get("term_months") or 0) != int(req.term_months):
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für einen anderen Kreditantrag verwendet")
        return {
            "ok": True,
            "credit": existing,
            "message": "Kreditantrag wurde bereits eingereicht.",
            "status": existing.get("status"),
            "replayed": True,
        }

    profile = await get_user_credit_profile(user_id)
    score_info = CREDIT_SCORES.get(profile["score"], CREDIT_SCORES["A"])
    if not score_info["can_borrow"]:
        if profile["score"] == "C":
            raise HTTPException(status_code=403, detail=f"Kredit gesperrt (Score C). Sperre bis: {profile.get('ban_until', 'unbekannt')}")
        raise HTTPException(status_code=403, detail=f"Kredit derzeit nicht möglich (Score {profile['score']})")

    commitments = await db.credits.find({
        "user_id": user_id,
        "status": {"$in": ["pending", "approving", "active", "reconciliation_required"]},
    }, {"_id": 0, "amount": 1, "remaining_amount": 1, "status": 1}).to_list(100)
    committed = 0.0
    for item in commitments:
        if item.get("status") == "active":
            committed += float(item.get("remaining_amount") or 0)
        else:
            committed += float(item.get("amount") or 0)
    available = max(0.0, float(score_info["max_amount"]) - committed)
    if float(req.amount) > available:
        raise HTTPException(status_code=400, detail=f"Maximaler verfügbarer Kredit: €{available:.2f}")

    now = datetime.now(timezone.utc)
    term = int(req.term_months)
    interest_rate = 0.059
    total_interest = round(float(req.amount) * interest_rate * (term / 12), 2)
    total_repayment = round(float(req.amount) + total_interest, 2)
    monthly_rate = round(total_repayment / term, 2)
    due_date = now + timedelta(days=30 * term)

    schedule = []
    remaining = total_repayment
    for i in range(term):
        payment_date = now + timedelta(days=30 * (i + 1))
        installment_amount = monthly_rate if i < term - 1 else round(max(0.0, remaining), 2)
        remaining = round(max(0.0, remaining - installment_amount), 2)
        schedule.append({
            "month": i + 1,
            "date": payment_date.strftime("%Y-%m-%d"),
            "amount": installment_amount,
            "remaining": remaining,
            "status": "pending",
        })

    credit = {
        "_id": credit_id,
        "credit_id": credit_id,
        "user_id": user_id,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", user.get("email", "")),
        "amount": round(float(req.amount), 2),
        "remaining_amount": total_repayment,
        "total_interest": total_interest,
        "total_repayment": total_repayment,
        "monthly_rate": monthly_rate,
        "term_months": term,
        "interest_rate": interest_rate,
        "schedule": schedule,
        "status": "pending",
        "auto_pay": True,
        "request_idempotency_hash": key_hash,
        "created_at": now.isoformat(),
        "due_date": due_date.isoformat(),
        "approved_at": None,
        "rejected_at": None,
        "rejection_reason": None,
        "paid_at": None,
        "payments": [],
        "next_payment_date": schedule[0]["date"] if schedule else None,
        "next_payment_month": 1,
    }

    write = await db.credits.update_one(
        {"_id": credit_id},
        {"$setOnInsert": credit},
        upsert=True,
    )
    if write.upserted_id is None:
        saved = await db.credits.find_one({"_id": credit_id}, {"_id": 0})
        if saved:
            return {"ok": True, "credit": saved, "status": saved.get("status"), "replayed": True}
        raise HTTPException(status_code=409, detail="Kreditantrag wurde parallel geändert")

    await db.credit_profiles.update_one(
        {"user_id": user_id},
        {"$inc": {"total_credits_taken": 1}},
    )
    await db.notifications.update_one(
        {"_id": f"credit-request:{credit_id}"},
        {"$setOnInsert": {
            "_id": f"credit-request:{credit_id}",
            "id": f"credit-request:{credit_id}",
            "user_id": user_id,
            "type": "credit",
            "title": "Kreditantrag eingereicht",
            "message": f"Dein Kreditantrag über €{req.amount:.2f} ({term} Monate) wird geprüft.",
            "read": False,
            "created_at": now.isoformat(),
        }},
        upsert=True,
    )

    public_credit = {k: v for k, v in credit.items() if k != "_id"}
    return {
        "ok": True,
        "credit": public_credit,
        "message": f"Kreditantrag über €{req.amount:.2f} eingereicht! Wartet auf Admin-Genehmigung.",
        "status": "pending",
        "replayed": False,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: Kredit genehmigen / ablehnen
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/pending")
async def get_pending_credits(request: Request):
    """Admin: Get all pending credit applications."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur für Admins")
    
    pending = await db.credits.find(
        {"status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    active = await db.credits.find(
        {"status": "active"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    all_credits = await db.credits.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    stats = {
        "pending_count": len(pending),
        "active_count": len(active),
        "total_pending_amount": sum(c.get("amount", 0) for c in pending),
        "total_active_debt": sum(c.get("remaining_amount", 0) for c in active),
    }
    
    return {"pending": pending, "active": active, "all": all_credits, "stats": stats}


class CreditDecision(BaseModel):
    credit_id: str
    action: str  # "approve" or "reject"
    reason: str = ""


@router.post("/admin/decide")
async def admin_decide_credit(req: CreditDecision, request: Request):
    """Admin credit decision with canonical, resumable wallet disbursement."""
    _require_credit_live()
    admin = await get_current_user(request)
    if admin.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(403, "Nur für Admins")
    if req.action not in {"approve", "reject"}:
        raise HTTPException(400, "action muss 'approve' oder 'reject' sein")

    credit = await db.credits.find_one({"credit_id": req.credit_id})
    if not credit:
        raise HTTPException(404, "Kredit nicht gefunden")

    now = datetime.now(timezone.utc)

    if req.action == "reject":
        if credit.get("status") == "rejected":
            return {"ok": True, "action": "rejected", "replayed": True}
        if credit.get("status") != "pending":
            raise HTTPException(409, f"Kredit kann aus Status {credit.get('status')} nicht abgelehnt werden")
        update = await db.credits.update_one(
            {"credit_id": req.credit_id, "status": "pending"},
            {"$set": {
                "status": "rejected",
                "rejected_at": now.isoformat(),
                "rejected_by": str(admin["_id"]),
                "rejection_reason": req.reason or "Antrag abgelehnt",
            }},
        )
        if update.modified_count != 1:
            fresh = await db.credits.find_one({"credit_id": req.credit_id}) or {}
            if fresh.get("status") != "rejected":
                raise HTTPException(409, "Kreditentscheidung wurde parallel geändert")

        await db.notifications.update_one(
            {"_id": f"credit-rejected:{req.credit_id}"},
            {"$setOnInsert": {
                "_id": f"credit-rejected:{req.credit_id}",
                "id": f"credit-rejected:{req.credit_id}",
                "user_id": credit["user_id"],
                "type": "credit_rejected",
                "title": "Kreditantrag abgelehnt",
                "message": f"Dein Kreditantrag über €{credit['amount']:.2f} wurde abgelehnt. Grund: {req.reason or 'Nicht angegeben'}",
                "read": False,
                "created_at": now.isoformat(),
            }},
            upsert=True,
        )
        return {"ok": True, "action": "rejected", "replayed": False}

    # Approve: resume an interrupted 'approving' operation or claim a fresh pending application.
    if credit.get("status") == "active":
        return {
            "ok": True,
            "action": "approved",
            "transaction_id": credit.get("disbursement_transaction_id"),
            "replayed": True,
        }
    if credit.get("status") == "reconciliation_required":
        raise HTTPException(409, "Kreditauszahlung benötigt manuelle Abstimmung")
    if credit.get("status") not in {"pending", "approving"}:
        raise HTTPException(409, f"Kredit kann aus Status {credit.get('status')} nicht genehmigt werden")

    pool_user_id = await _credit_pool_user_id()
    if not pool_user_id:
        raise HTTPException(503, "CREDIT_POOL_EMAIL ist nicht konfiguriert")
    if pool_user_id == str(credit["user_id"]):
        raise HTTPException(409, "Credit Pool darf nicht identisch mit dem Kreditnehmer sein")

    attempt = int(credit.get("approval_attempt") or 0)
    if credit.get("status") == "pending":
        attempt += 1
        claim = await db.credits.update_one(
            {"credit_id": req.credit_id, "status": "pending"},
            {"$set": {
                "status": "approving",
                "approval_attempt": attempt,
                "approval_started_at": now.isoformat(),
                "approval_started_by": str(admin["_id"]),
            }},
        )
        if claim.modified_count != 1:
            credit = await db.credits.find_one({"credit_id": req.credit_id}) or {}
            if credit.get("status") == "active":
                return {
                    "ok": True,
                    "action": "approved",
                    "transaction_id": credit.get("disbursement_transaction_id"),
                    "replayed": True,
                }
            if credit.get("status") != "approving":
                raise HTTPException(409, "Kreditentscheidung wurde parallel geändert")
            attempt = int(credit.get("approval_attempt") or 0)
    else:
        attempt = max(1, attempt)

    credit = await db.credits.find_one({"credit_id": req.credit_id}) or credit
    disbursement = await transfer_between_wallets(
        from_user_id=pool_user_id,
        to_user_id=str(credit["user_id"]),
        amount=round(float(credit["amount"]), 2),
        tx_type=TransactionType.TRANSFER,
        description=f"BidBlitz Credit Auszahlung {credit['credit_id']}",
        reference=f"CREDIT-{credit['credit_id']}",
        metadata={
            "credit_id": credit["credit_id"],
            "kind": "credit_disbursement",
            "approved_by": str(admin["_id"]),
            "term_months": credit.get("term_months"),
            "total_repayment": credit.get("total_repayment"),
        },
        idempotency_key=f"credit:disbursement:{credit['credit_id']}:{attempt}",
    )
    if not disbursement.success:
        status_value = str(getattr(disbursement.status, "value", disbursement.status))
        if status_value in {"pending", "reconciliation_required"}:
            await db.credits.update_one(
                {"credit_id": req.credit_id, "status": "approving", "approval_attempt": attempt},
                {"$set": {
                    "status": "reconciliation_required",
                    "disbursement_status": status_value,
                    "disbursement_error": disbursement.error,
                    "disbursement_checked_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            raise HTTPException(409, disbursement.error or "Kreditauszahlung benötigt Abstimmung")

        await db.credits.update_one(
            {"credit_id": req.credit_id, "status": "approving", "approval_attempt": attempt},
            {"$set": {
                "status": "pending",
                "last_disbursement_error": disbursement.error,
                "last_disbursement_failed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(400, disbursement.error or "Kreditauszahlung fehlgeschlagen")

    approval_time = datetime.now(timezone.utc)
    term = int(credit["term_months"])
    total_repayment = round(float(credit["total_repayment"]), 2)
    rate = round(float(credit["monthly_rate"]), 2)
    schedule = []
    remaining = total_repayment
    for i in range(term):
        payment_date = approval_time + timedelta(days=30 * (i + 1))
        installment_amount = rate if i < term - 1 else round(max(0.0, remaining), 2)
        remaining = round(max(0.0, remaining - installment_amount), 2)
        schedule.append({
            "month": i + 1,
            "date": payment_date.strftime("%Y-%m-%d"),
            "amount": installment_amount,
            "remaining": remaining,
            "status": "pending",
        })

    if not await _record_credit_disbursement_profile_once(credit):
        await db.credits.update_one(
            {"credit_id": req.credit_id},
            {"$set": {
                "status": "reconciliation_required",
                "disbursement_transaction_id": disbursement.transaction_id,
                "disbursement_error": "Credit profile debt marker could not be persisted",
            }},
        )
        raise HTTPException(500, "Kreditauszahlung erfolgt; Profil benötigt Abstimmung")

    activated = await db.credits.update_one(
        {"credit_id": req.credit_id, "status": "approving", "approval_attempt": attempt},
        {"$set": {
            "status": "active",
            "approved_at": approval_time.isoformat(),
            "approved_by": str(admin["_id"]),
            "schedule": schedule,
            "due_date": (approval_time + timedelta(days=30 * term)).isoformat(),
            "next_payment_date": schedule[0]["date"],
            "next_payment_month": 1,
            "disbursement_status": "completed",
            "disbursement_transaction_id": disbursement.transaction_id,
            "disbursement_reference": disbursement.reference,
            "credit_pool_user_id": pool_user_id,
        }},
    )
    if activated.modified_count != 1:
        fresh = await db.credits.find_one({"credit_id": req.credit_id}) or {}
        if fresh.get("status") != "active" or fresh.get("disbursement_transaction_id") != disbursement.transaction_id:
            await db.credits.update_one(
                {"credit_id": req.credit_id},
                {"$set": {
                    "status": "reconciliation_required",
                    "disbursement_transaction_id": disbursement.transaction_id,
                    "disbursement_error": "Activation state changed after wallet disbursement",
                }},
            )
            raise HTTPException(500, "Kreditauszahlung erfolgt; Aktivierung benötigt Abstimmung")

    await db.notifications.update_one(
        {"_id": f"credit-approved:{req.credit_id}"},
        {"$setOnInsert": {
            "_id": f"credit-approved:{req.credit_id}",
            "id": f"credit-approved:{req.credit_id}",
            "user_id": credit["user_id"],
            "type": "credit_approved",
            "title": "Kredit genehmigt!",
            "message": f"Dein Kredit über €{credit['amount']:.2f} wurde genehmigt. Erste Rate: €{schedule[0]['amount']:.2f} am {schedule[0]['date']}.",
            "read": False,
            "created_at": approval_time.isoformat(),
        }},
        upsert=True,
    )

    return {
        "ok": True,
        "action": "approved",
        "transaction_id": disbursement.transaction_id,
        "replayed": bool(disbursement.idempotent_replay),
    }


async def _reserve_credit_repayment(
    credit_id: str,
    user_id: str,
    requested_amount: float,
    operation_key: str,
    kind: str,
) -> tuple[dict, float, str, bool]:
    """Reserve part of remaining debt exactly once before moving wallet money."""
    marker_hash = hashlib.sha256(operation_key.encode("utf-8")).hexdigest()[:24]
    marker_field = f"repayment_markers.{marker_hash}"

    for _ in range(6):
        credit = await db.credits.find_one({"credit_id": credit_id, "user_id": user_id})
        if not credit:
            raise HTTPException(status_code=404, detail="Kredit nicht gefunden")

        marker = (credit.get("repayment_markers") or {}).get(marker_hash)
        if marker:
            if round(float(marker.get("requested_amount") or 0), 2) != round(float(requested_amount), 2):
                raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderem Rückzahlungsbetrag verwendet")
            return credit, round(float(marker.get("reserved_amount") or 0), 2), marker_hash, True

        if credit.get("status") == "paid":
            raise HTTPException(status_code=409, detail="Kredit bereits vollständig bezahlt")
        if credit.get("status") != "active":
            raise HTTPException(status_code=409, detail=f"Kredit kann aus Status {credit.get('status')} nicht zurückgezahlt werden")

        remaining = round(float(credit.get("remaining_amount") or 0), 2)
        if remaining <= 0.01:
            raise HTTPException(status_code=409, detail="Keine offene Restschuld")
        amount = round(min(float(requested_amount), remaining), 2)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Ungültiger Rückzahlungsbetrag")

        result = await db.credits.update_one(
            {
                "credit_id": credit_id,
                "user_id": user_id,
                "status": "active",
                "remaining_amount": {"$gte": amount},
                marker_field: {"$exists": False},
            },
            {
                "$inc": {"remaining_amount": -amount},
                "$set": {
                    marker_field: {
                        "operation_key_hash": marker_hash,
                        "requested_amount": round(float(requested_amount), 2),
                        "reserved_amount": amount,
                        "kind": kind,
                        "status": "reserved",
                        "reserved_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            },
        )
        if result.modified_count == 1:
            fresh = await db.credits.find_one({"credit_id": credit_id, "user_id": user_id}) or credit
            return fresh, amount, marker_hash, False

    raise HTTPException(status_code=409, detail="Restschuld wurde parallel geändert. Bitte erneut versuchen.")


async def _rollback_credit_repayment(credit_id: str, marker_hash: str, amount: float, error: str) -> None:
    field = f"repayment_markers.{marker_hash}"
    await db.credits.update_one(
        {"credit_id": credit_id, f"{field}.status": "reserved"},
        {
            "$inc": {"remaining_amount": round(float(amount), 2)},
            "$set": {
                f"{field}.status": "failed",
                f"{field}.error": str(error)[:500],
                f"{field}.failed_at": datetime.now(timezone.utc).isoformat(),
            },
        },
    )


async def _complete_credit_repayment_marker(
    credit_id: str,
    marker_hash: str,
    amount: float,
    transaction_id: Optional[str],
    payment_type: str,
    extra_set: Optional[dict] = None,
) -> bool:
    field = f"repayment_markers.{marker_hash}"
    payment_event_id = f"credit-payment:{credit_id}:{marker_hash}"
    now = datetime.now(timezone.utc).isoformat()
    payment_record = {
        "payment_id": payment_event_id,
        "amount": round(float(amount), 2),
        "date": now,
        "type": payment_type,
        "wallet_transaction_id": transaction_id,
    }
    update_set = {
        f"{field}.status": "completed",
        f"{field}.transaction_id": transaction_id,
        f"{field}.completed_at": now,
        **(extra_set or {}),
    }
    result = await db.credits.update_one(
        {"credit_id": credit_id, f"{field}.status": "reserved"},
        {
            "$set": update_set,
            "$push": {"payments": payment_record},
        },
    )
    await db.credit_payment_events.update_one(
        {"_id": payment_event_id},
        {"$setOnInsert": {
            "_id": payment_event_id,
            "credit_id": credit_id,
            **payment_record,
        }},
        upsert=True,
    )
    if result.modified_count == 1:
        return True
    existing = await db.credits.find_one(
        {"credit_id": credit_id, f"{field}.status": "completed"},
        {"_id": 1},
    )
    return bool(existing)


async def _record_credit_profile_repayment_once(
    credit: dict,
    amount: float,
    marker_hash: str,
) -> bool:
    field = f"repayment_markers.{marker_hash}"
    result = await db.credit_profiles.update_one(
        {"user_id": credit["user_id"], field: {"$exists": False}},
        {
            "$inc": {"total_repaid": round(float(amount), 2)},
            "$set": {
                field: {
                    "credit_id": credit["credit_id"],
                    "amount": round(float(amount), 2),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
        upsert=True,
    )
    if result.modified_count == 1 or result.upserted_id is not None:
        return True
    profile = await db.credit_profiles.find_one(
        {"user_id": credit["user_id"], field: {"$exists": True}},
        {"_id": 1},
    )
    return bool(profile)


def _credit_has_pending_repayment_markers(credit: dict) -> bool:
    return any(
        isinstance(marker, dict) and marker.get("status") == "reserved"
        for marker in (credit.get("repayment_markers") or {}).values()
    )


async def _finalize_credit_if_paid(credit_id: str) -> tuple[dict, bool]:
    credit = await db.credits.find_one({"credit_id": credit_id})
    if not credit:
        raise HTTPException(status_code=404, detail="Kredit nicht gefunden")
    if credit.get("status") == "paid":
        return credit, False
    remaining = round(float(credit.get("remaining_amount") or 0), 2)
    if remaining > 0.01 or _credit_has_pending_repayment_markers(credit):
        return credit, False

    now = datetime.now(timezone.utc)
    transition = await db.credits.update_one(
        {
            "credit_id": credit_id,
            "status": "active",
            "remaining_amount": {"$lte": 0.01},
        },
        {"$set": {
            "status": "paid",
            "remaining_amount": 0.0,
            "paid_at": now.isoformat(),
        }},
    )
    fresh = await db.credits.find_one({"credit_id": credit_id}) or credit
    if transition.modified_count != 1:
        return fresh, False

    payoff_marker = hashlib.sha256(f"credit-payoff:{credit_id}".encode("utf-8")).hexdigest()[:24]
    field = f"payoff_markers.{payoff_marker}"
    due_date = datetime.fromisoformat(str(fresh["due_date"]).replace("Z", "+00:00"))
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)

    inc = {"current_debt": -round(float(fresh.get("amount") or 0), 2)}
    if now <= due_date + timedelta(days=GRACE_PERIOD_DAYS):
        inc["on_time_payments"] = 1
    else:
        inc["late_payments"] = 1

    profile_update = await db.credit_profiles.update_one(
        {"user_id": fresh["user_id"], field: {"$exists": False}},
        {
            "$inc": inc,
            "$set": {
                field: {
                    "credit_id": credit_id,
                    "paid_at": now.isoformat(),
                }
            },
        },
    )
    if profile_update.modified_count == 1:
        profile = await get_user_credit_profile(fresh["user_id"])
        if profile.get("score") == "B" and now <= due_date + timedelta(days=GRACE_PERIOD_DAYS):
            await update_credit_score(fresh["user_id"], "A", "Pünktliche Rückzahlung")
    return fresh, True


# ══════════════════════════════════════════════════════════════════════════════
# AUTO-PAY: Automatische Kreditraten-Einzug (Background Task)
# ══════════════════════════════════════════════════════════════════════════════

async def process_auto_credit_payments():
    """
    Background task: Automatically deducts monthly credit payments from wallet.
    Called periodically (every hour). Checks if any installment is due today.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Find all active credits with auto_pay enabled
    active_credits = await db.credits.find({
        "status": "active",
        "auto_pay": True,
    }).to_list(500)
    
    processed = 0
    failed = 0
    
    for credit in active_credits:
        schedule = credit.get("schedule", [])
        next_month = credit.get("next_payment_month", 1)
        
        # Find the next unpaid installment
        for inst in schedule:
            if inst.get("status") == "paid":
                continue
            if inst["date"] <= today:
                # This installment is due!
                user_id = credit["user_id"]
                rate = inst["amount"]
                
                # Check wallet balance
                from bson import ObjectId
                try:
                    user = await db.users.find_one({"_id": ObjectId(user_id)})
                except Exception:
                    user = await db.users.find_one({"id": user_id})
                
                if not user:
                    continue
                
                balance = user.get("balance", 0)
                
                if balance >= rate:
                    # AUTO-PAY: Deduct from wallet
                    await db.users.update_one(
                        {"_id": user["_id"]},
                        {"$inc": {"balance": -rate}}
                    )
                    
                    # Mark installment as paid
                    inst["status"] = "paid"
                    inst["paid_at"] = datetime.now(timezone.utc).isoformat()
                    
                    # Update credit
                    new_remaining = round(credit.get("remaining_amount", 0) - rate, 2)
                    is_fully_paid = new_remaining <= 0.01
                    
                    update = {
                        "remaining_amount": max(0, new_remaining),
                        "schedule": schedule,
                        "next_payment_month": inst["month"] + 1,
                    }
                    
                    if is_fully_paid:
                        update["status"] = "paid"
                        update["paid_at"] = datetime.now(timezone.utc).isoformat()
                    else:
                        # Find next unpaid date
                        next_unpaid = next((s for s in schedule if s.get("status") != "paid"), None)
                        if next_unpaid:
                            update["next_payment_date"] = next_unpaid["date"]
                    
                    await db.credits.update_one(
                        {"credit_id": credit["credit_id"]},
                        {"$set": update, "$push": {"payments": {
                            "amount": rate,
                            "date": datetime.now(timezone.utc).isoformat(),
                            "remaining_after": max(0, new_remaining),
                            "type": "auto_pay",
                        }}}
                    )
                    
                    # Transaction
                    await db.transactions.insert_one({
                        "tx_id": secrets.token_hex(8),
                        "user_id": user_id,
                        "type": "CREDIT_PAYMENT",
                        "amount": rate,
                        "description": f"Kreditrate Monat {inst['month']} (Auto-Pay) - ID: {credit['credit_id'][:8]}",
                        "credit_id": credit["credit_id"],
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
                    
                    # Notify: payment successful
                    msg = f"Kreditrate €{rate:.2f} (Monat {inst['month']}/{credit['term_months']}) wurde automatisch abgebucht."
                    if is_fully_paid:
                        msg += " Dein Kredit ist vollständig bezahlt!"
                    else:
                        msg += f" Restschuld: €{max(0,new_remaining):.2f}"
                    
                    await db.notifications.insert_one({
                        "id": secrets.token_hex(8),
                        "user_id": user_id,
                        "type": "credit_payment",
                        "title": "Kreditrate abgebucht",
                        "message": msg,
                        "read": False,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
                    
                    # Update profile
                    profile_update = {"$inc": {"total_repaid": rate}}
                    if is_fully_paid:
                        profile_update["$inc"]["current_debt"] = -credit["amount"]
                    await db.credit_profiles.update_one(
                        {"user_id": user_id}, profile_update
                    )
                    
                    processed += 1
                    
                else:
                    # NOT ENOUGH BALANCE — notify user to top up
                    shortfall = round(rate - balance, 2)
                    
                    await db.notifications.insert_one({
                        "id": secrets.token_hex(8),
                        "user_id": user_id,
                        "type": "credit_payment_failed",
                        "title": "Kreditrate konnte nicht abgebucht werden!",
                        "message": f"Deine Kreditrate über €{rate:.2f} konnte nicht abgebucht werden. Dir fehlen €{shortfall:.2f}. Bitte lade dein Wallet auf!",
                        "read": False,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "action_url": "/wallet",
                    })
                    
                    failed += 1
                
                break  # Only process one installment per credit per cycle
    
    return {"processed": processed, "failed": failed}


@router.post("/repay")
async def repay_credit(req: RepaymentRequest, request: Request):
    """Repay credit through the canonical wallet ledger exactly once."""
    _require_credit_live()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    pool_user_id = await _credit_pool_user_id()
    if not pool_user_id:
        raise HTTPException(status_code=503, detail="CREDIT_POOL_EMAIL ist nicht konfiguriert")
    if pool_user_id == user_id:
        raise HTTPException(status_code=409, detail="Credit Pool darf nicht identisch mit Kreditnehmer sein")

    op_key = f"credit:manual-repay:{req.credit_id}:{user_id}:{req.idempotency_key.strip()}"
    credit, payment_amount, marker_hash, replay_marker = await _reserve_credit_repayment(
        req.credit_id,
        user_id,
        round(float(req.amount), 2),
        op_key,
        "manual",
    )
    marker = (credit.get("repayment_markers") or {}).get(marker_hash) or {}
    if replay_marker and marker.get("status") == "completed":
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        fresh_credit = await db.credits.find_one({"credit_id": req.credit_id}, {"_id": 0}) or credit
        return {
            "ok": True,
            "paid_amount": payment_amount,
            "remaining_debt": round(float(fresh_credit.get("remaining_amount") or 0), 2),
            "is_fully_paid": fresh_credit.get("status") == "paid",
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "replayed": True,
        }
    if replay_marker and marker.get("status") == "failed":
        raise HTTPException(status_code=409, detail=marker.get("error") or "Dieser Rückzahlungsversuch ist fehlgeschlagen")

    payment = await transfer_between_wallets(
        from_user_id=user_id,
        to_user_id=pool_user_id,
        amount=payment_amount,
        tx_type=TransactionType.TRANSFER,
        description=f"Kredit-Rückzahlung {req.credit_id}",
        reference=f"CREDIT-REPAY-{req.credit_id}-{marker_hash[:8].upper()}",
        metadata={
            "credit_id": req.credit_id,
            "kind": "credit_repayment",
            "payment_type": "manual",
        },
        idempotency_key=op_key,
    )
    if not payment.success:
        status_value = str(getattr(payment.status, "value", payment.status))
        if status_value in {"pending", "reconciliation_required"}:
            await db.credits.update_one(
                {"credit_id": req.credit_id, f"repayment_markers.{marker_hash}.status": "reserved"},
                {"$set": {
                    f"repayment_markers.{marker_hash}.status": "reconciliation_required",
                    f"repayment_markers.{marker_hash}.error": payment.error,
                }},
            )
            raise HTTPException(status_code=409, detail=payment.error or "Rückzahlung benötigt Abstimmung")
        await _rollback_credit_repayment(req.credit_id, marker_hash, payment_amount, payment.error or "Wallet transfer failed")
        raise HTTPException(status_code=400, detail=payment.error or "Rückzahlung fehlgeschlagen")

    if not await _complete_credit_repayment_marker(
        req.credit_id,
        marker_hash,
        payment_amount,
        payment.transaction_id,
        "manual",
    ):
        await db.credits.update_one(
            {"credit_id": req.credit_id},
            {"$set": {"status": "reconciliation_required", "reconciliation_reason": "repayment_marker_finalize_failed"}},
        )
        raise HTTPException(status_code=500, detail="Wallet-Zahlung erfolgt; Kredit benötigt Abstimmung")

    fresh_credit = await db.credits.find_one({"credit_id": req.credit_id}) or credit
    if not await _record_credit_profile_repayment_once(fresh_credit, payment_amount, marker_hash):
        await db.credits.update_one(
            {"credit_id": req.credit_id},
            {"$set": {"status": "reconciliation_required", "reconciliation_reason": "credit_profile_payment_marker_failed"}},
        )
        raise HTTPException(status_code=500, detail="Rückzahlung verbucht; Kreditprofil benötigt Abstimmung")

    fresh_credit, _ = await _finalize_credit_if_paid(req.credit_id)
    fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
    return {
        "ok": True,
        "paid_amount": payment_amount,
        "remaining_debt": round(float(fresh_credit.get("remaining_amount") or 0), 2),
        "is_fully_paid": fresh_credit.get("status") == "paid",
        "new_balance": round(float(fresh_user.get("balance") or 0), 2),
        "message": "Kredit vollständig bezahlt! 🎉" if fresh_credit.get("status") == "paid" else f"€{payment_amount:.2f} bezahlt",
        "replayed": bool(payment.idempotent_replay or replay_marker),
    }


@router.get("/history")
async def get_credit_history(request: Request):
    """Get user's credit history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get all credits
    credits = await db.credits.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    
    for c in credits:
        c.pop("_id", None)
        # Calculate days until due / overdue
        if c["status"] == "active":
            due = datetime.fromisoformat(c["due_date"].replace("Z", "+00:00"))
            days = (due - datetime.now(timezone.utc)).days
            c["days_until_due"] = days
            c["is_overdue"] = days < 0
    
    # Get score history
    score_history = await db.credit_score_history.find(
        {"user_id": user_id}
    ).sort("timestamp", -1).to_list(20)
    
    for s in score_history:
        s.pop("_id", None)
    
    return {
        "credits": credits,
        "score_history": score_history,
        "total_borrowed": sum(c.get("amount", 0) for c in credits),
        "total_repaid": sum(c.get("amount", 0) - c.get("remaining_amount", 0) for c in credits),
    }


@router.post("/upgrade-request")
async def request_score_upgrade(request: Request):
    """Request to upgrade score after ban period (C -> B)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    profile = await get_user_credit_profile(user_id)
    
    if profile["score"] != "C":
        raise HTTPException(status_code=400, detail="Nur bei Score C möglich")
    
    # Check if ban period is over
    if profile.get("ban_until"):
        ban_until = datetime.fromisoformat(profile["ban_until"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) < ban_until:
            days_left = (ban_until - datetime.now(timezone.utc)).days
            raise HTTPException(
                status_code=400, 
                detail=f"Sperrzeit noch nicht abgelaufen. Noch {days_left} Tage."
            )
    
    # Check if all debts are paid
    active_credits = await db.credits.find({
        "user_id": user_id,
        "status": "active"
    }).to_list(10)
    
    if active_credits:
        total_debt = sum(c.get("remaining_amount", 0) for c in active_credits)
        raise HTTPException(
            status_code=400, 
            detail=f"Bitte zuerst alle Schulden bezahlen (€{total_debt:.2f} offen)"
        )
    
    # Upgrade to B
    await update_credit_score(user_id, "B", "Upgrade nach Sperrzeit und Schuldenfreiheit")
    await db.credit_profiles.update_one(
        {"user_id": user_id},
        {"$set": {"ban_until": None}}
    )
    
    return {
        "ok": True,
        "new_score": "B",
        "message": "Score auf B verbessert! Nach pünktlicher Rückzahlung wird Score A wiederhergestellt.",
    }
