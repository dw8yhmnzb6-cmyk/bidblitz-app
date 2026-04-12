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
    
    for c in active_credits:
        c.pop("_id", None)
    
    total_debt = sum(c.get("remaining_amount", 0) for c in active_credits)
    
    # Calculate available credit
    available_credit = max(0, score_info["max_amount"] - total_debt) if score_info["can_borrow"] else 0
    
    return {
        "score": profile["score"],
        "score_label": score_info["label"],
        "score_color": score_info["color"],
        "can_borrow": score_info["can_borrow"] and available_credit > 0,
        "max_credit": score_info["max_amount"],
        "available_credit": round(available_credit, 2),
        "current_debt": round(total_debt, 2),
        "active_credit": round(total_debt, 2),  # Alias for frontend
        "active_credits": active_credits,
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
    
    # Create credit
    credit = {
        "credit_id": secrets.token_hex(8),
        "user_id": user_id,
        "amount": round(req.amount, 2),
        "remaining_amount": total_repayment,
        "total_interest": total_interest,
        "total_repayment": total_repayment,
        "monthly_rate": monthly_rate,
        "term_months": term,
        "interest_rate": interest_rate,
        "schedule": schedule,
        "status": "active",
        "created_at": now.isoformat(),
        "due_date": due_date.isoformat(),
        "paid_at": None,
        "payments": [],
    }
    
    await db.credits.insert_one(credit)
    
    # Add amount to user's wallet
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": req.amount}}
    )
    
    # Update profile stats
    await db.credit_profiles.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "total_credits_taken": 1,
                "current_debt": req.amount
            }
        }
    )
    
    # Create transaction record
    await db.transactions.insert_one({
        "tx_id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "CREDIT_RECEIVED",
        "amount": req.amount,
        "description": f"Kredit erhalten (ID: {credit['credit_id'][:8]})",
        "credit_id": credit["credit_id"],
        "created_at": now.isoformat(),
    })
    
    credit.pop("_id", None)
    
    return {
        "ok": True,
        "credit": credit,
        "message": f"€{req.amount:.2f} Kredit wurde deinem Wallet gutgeschrieben!",
        "due_date": due_date.strftime("%d.%m.%Y"),
        "new_balance": round(user.get("balance", 0) + req.amount, 2),
    }


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
