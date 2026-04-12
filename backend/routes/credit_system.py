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
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user

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


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class CreditRequest(BaseModel):
    amount: float = Field(..., gt=0, le=MAX_CREDIT_AMOUNT, description="Kreditbetrag in EUR")
    term_months: int = Field(default=6, ge=1, le=36, description="Laufzeit in Monaten")


class RepaymentRequest(BaseModel):
    credit_id: str
    amount: float = Field(..., gt=0)


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
@router.post("/apply")  # Alias for frontend
async def request_credit(req: CreditRequest, request: Request):
    """Request a new credit (BNPL)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get credit profile
    profile = await get_user_credit_profile(user_id)
    score_info = CREDIT_SCORES.get(profile["score"], CREDIT_SCORES["A"])
    
    # Check if user can borrow
    if not score_info["can_borrow"]:
        if profile["score"] == "C":
            ban_until = profile.get("ban_until", "unbekannt")
            raise HTTPException(
                status_code=403, 
                detail=f"Kredit gesperrt (Score C). Sperre bis: {ban_until}"
            )
        raise HTTPException(
            status_code=403, 
            detail=f"Kredit derzeit nicht möglich (Score {profile['score']})"
        )
    
    # Check current debt
    active_credits = await db.credits.find({
        "user_id": user_id,
        "status": "active"
    }).to_list(10)
    
    total_debt = sum(c.get("remaining_amount", 0) for c in active_credits)
    available = score_info["max_amount"] - total_debt
    
    if req.amount > available:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximaler verfügbarer Kredit: €{available:.2f}"
        )
    
    now = datetime.now(timezone.utc)
    term = req.term_months
    interest_rate = 0.059  # 5.9% p.a.
    total_interest = round(req.amount * interest_rate * (term / 12), 2)
    total_repayment = round(req.amount + total_interest, 2)
    monthly_rate = round(total_repayment / term, 2)
    due_date = now + timedelta(days=30 * term)
    
    # Build repayment schedule
    schedule = []
    remaining = total_repayment
    for i in range(term):
        payment_date = now + timedelta(days=30 * (i + 1))
        remaining = round(remaining - monthly_rate, 2)
        if remaining < 0:
            remaining = 0
        schedule.append({
            "month": i + 1,
            "date": payment_date.strftime("%Y-%m-%d"),
            "amount": monthly_rate,
            "remaining": remaining,
        })
    
    # Create credit — status "pending" (wartet auf Admin-Genehmigung)
    credit = {
        "credit_id": secrets.token_hex(8),
        "user_id": user_id,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", user.get("email", "")),
        "amount": round(req.amount, 2),
        "remaining_amount": total_repayment,
        "total_interest": total_interest,
        "total_repayment": total_repayment,
        "monthly_rate": monthly_rate,
        "term_months": term,
        "interest_rate": interest_rate,
        "schedule": schedule,
        "status": "pending",  # pending → approved → active → paid  |  pending → rejected
        "auto_pay": True,
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
    
    await db.credits.insert_one(credit)
    
    # DO NOT add money yet — wait for admin approval
    
    # Update profile stats
    await db.credit_profiles.update_one(
        {"user_id": user_id},
        {"$inc": {"total_credits_taken": 1}}
    )
    
    # Notify user
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "credit",
        "title": "Kreditantrag eingereicht",
        "message": f"Dein Kreditantrag über €{req.amount:.2f} ({term} Monate) wird geprüft. Du erhältst eine Benachrichtigung sobald er bearbeitet wurde.",
        "read": False,
        "created_at": now.isoformat(),
    })
    
    credit.pop("_id", None)
    
    return {
        "ok": True,
        "credit": credit,
        "message": f"Kreditantrag über €{req.amount:.2f} eingereicht! Wartet auf Admin-Genehmigung.",
        "status": "pending",
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
    """Admin: Approve or reject a credit application."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur für Admins")
    
    credit = await db.credits.find_one({"credit_id": req.credit_id})
    if not credit:
        raise HTTPException(404, "Kredit nicht gefunden")
    if credit["status"] != "pending":
        raise HTTPException(400, f"Kredit ist nicht mehr 'pending', aktuell: {credit['status']}")
    
    now = datetime.now(timezone.utc)
    applicant = await db.users.find_one({"id": credit["user_id"]})
    if not applicant:
        # Try by _id string
        from bson import ObjectId
        try:
            applicant = await db.users.find_one({"_id": ObjectId(credit["user_id"])})
        except Exception:
            pass
    
    if req.action == "approve":
        # Activate credit + pay out to wallet
        # Recalculate schedule from TODAY (approval date)
        term = credit["term_months"]
        schedule = []
        remaining = credit["total_repayment"]
        rate = credit["monthly_rate"]
        for i in range(term):
            payment_date = now + timedelta(days=30 * (i + 1))
            remaining = round(remaining - rate, 2)
            if remaining < 0:
                remaining = 0
            schedule.append({
                "month": i + 1,
                "date": payment_date.strftime("%Y-%m-%d"),
                "amount": rate,
                "remaining": remaining,
                "status": "pending",
            })
        
        due_date = now + timedelta(days=30 * term)
        
        await db.credits.update_one(
            {"credit_id": req.credit_id},
            {"$set": {
                "status": "active",
                "approved_at": now.isoformat(),
                "approved_by": str(user["_id"]),
                "schedule": schedule,
                "due_date": due_date.isoformat(),
                "next_payment_date": schedule[0]["date"],
                "next_payment_month": 1,
            }}
        )
        
        # Credit wallet
        if applicant:
            await db.users.update_one(
                {"_id": applicant["_id"]},
                {"$inc": {"balance": credit["amount"]}}
            )
            
            # Update credit profile
            await db.credit_profiles.update_one(
                {"user_id": credit["user_id"]},
                {"$inc": {"current_debt": credit["amount"]}}
            )
            
            # Transaction record
            await db.transactions.insert_one({
                "tx_id": secrets.token_hex(8),
                "user_id": credit["user_id"],
                "type": "CREDIT_RECEIVED",
                "amount": credit["amount"],
                "description": f"Kredit genehmigt und ausgezahlt (ID: {credit['credit_id'][:8]})",
                "credit_id": credit["credit_id"],
                "created_at": now.isoformat(),
            })
        
        # Notify user
        await db.notifications.insert_one({
            "id": secrets.token_hex(8),
            "user_id": credit["user_id"],
            "type": "credit_approved",
            "title": "Kredit genehmigt!",
            "message": f"Dein Kredit über €{credit['amount']:.2f} wurde genehmigt und deinem Wallet gutgeschrieben. Erste Rate: €{rate:.2f} am {schedule[0]['date']}.",
            "read": False,
            "created_at": now.isoformat(),
        })
        
        return {
            "ok": True,
            "action": "approved",
            "message": f"Kredit €{credit['amount']:.2f} genehmigt und an {credit.get('user_email','')} ausgezahlt.",
        }
    
    elif req.action == "reject":
        await db.credits.update_one(
            {"credit_id": req.credit_id},
            {"$set": {
                "status": "rejected",
                "rejected_at": now.isoformat(),
                "rejected_by": str(user["_id"]),
                "rejection_reason": req.reason or "Antrag abgelehnt",
            }}
        )
        
        # Notify user
        await db.notifications.insert_one({
            "id": secrets.token_hex(8),
            "user_id": credit["user_id"],
            "type": "credit_rejected",
            "title": "Kreditantrag abgelehnt",
            "message": f"Dein Kreditantrag über €{credit['amount']:.2f} wurde leider abgelehnt. Grund: {req.reason or 'Nicht angegeben'}",
            "read": False,
            "created_at": now.isoformat(),
        })
        
        return {
            "ok": True,
            "action": "rejected",
            "message": f"Kredit €{credit['amount']:.2f} abgelehnt.",
        }
    
    raise HTTPException(400, "action muss 'approve' oder 'reject' sein")


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
    """Repay a credit (partially or fully)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find the credit
    credit = await db.credits.find_one({
        "credit_id": req.credit_id,
        "user_id": user_id
    })
    
    if not credit:
        raise HTTPException(status_code=404, detail="Kredit nicht gefunden")
    
    if credit["status"] == "paid":
        raise HTTPException(status_code=400, detail="Kredit bereits vollständig bezahlt")
    
    # Check user balance
    if user.get("balance", 0) < req.amount:
        raise HTTPException(status_code=400, detail="Nicht genug Guthaben")
    
    remaining = credit.get("remaining_amount", credit["amount"])
    payment_amount = min(req.amount, remaining)
    
    now = datetime.now(timezone.utc)
    
    # Deduct from wallet
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -payment_amount}}
    )
    
    # Update credit
    new_remaining = round(remaining - payment_amount, 2)
    is_fully_paid = new_remaining <= 0.01  # Allow small rounding errors
    
    update_data = {
        "remaining_amount": max(0, new_remaining),
    }
    
    if is_fully_paid:
        update_data["status"] = "paid"
        update_data["paid_at"] = now.isoformat()
    
    # Add payment to history
    payment_record = {
        "amount": payment_amount,
        "date": now.isoformat(),
        "remaining_after": max(0, new_remaining),
    }
    
    await db.credits.update_one(
        {"credit_id": req.credit_id},
        {
            "$set": update_data,
            "$push": {"payments": payment_record}
        }
    )
    
    # Update profile
    profile_update = {"$inc": {"total_repaid": payment_amount}}
    
    if is_fully_paid:
        profile_update["$inc"]["current_debt"] = -credit["amount"]
        
        # Check if paid on time
        due_date = datetime.fromisoformat(credit["due_date"].replace("Z", "+00:00"))
        
        if now <= due_date:
            # Paid on time - maintain or improve score
            profile_update["$inc"]["on_time_payments"] = 1
            
            profile = await get_user_credit_profile(user_id)
            if profile["score"] == "B":
                # Can upgrade back to A after on-time payment
                await update_credit_score(user_id, "A", "Pünktliche Rückzahlung")
        elif now <= due_date + timedelta(days=GRACE_PERIOD_DAYS):
            # Within grace period - still ok
            profile_update["$inc"]["on_time_payments"] = 1
        else:
            # Late payment
            profile_update["$inc"]["late_payments"] = 1
    
    await db.credit_profiles.update_one({"user_id": user_id}, profile_update)
    
    # Create transaction record
    await db.transactions.insert_one({
        "tx_id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "CREDIT_REPAYMENT",
        "amount": -payment_amount,
        "description": f"Kredit-Rückzahlung (ID: {req.credit_id[:8]})",
        "credit_id": req.credit_id,
        "created_at": now.isoformat(),
    })
    
    # Get updated user
    updated_user = await db.users.find_one({"_id": user["_id"]})
    
    return {
        "ok": True,
        "paid_amount": payment_amount,
        "remaining_debt": max(0, new_remaining),
        "is_fully_paid": is_fully_paid,
        "new_balance": round(updated_user.get("balance", 0), 2),
        "message": "Kredit vollständig bezahlt! 🎉" if is_fully_paid else f"€{payment_amount:.2f} bezahlt, noch €{new_remaining:.2f} offen",
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
