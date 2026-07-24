"""
BidBlitz V2 — Instant Credit (Sofort-Kredit)
- Bis zu 100€ in 3 Minuten
- Zinsfrei (0% APR)
- Automatische Rückzahlung aus eingehenden Wallet-Eingängen
- Gebühr: einmalig 1,99€ pro Auszahlung (oder gratis für Premium)
- 30 Tage Rückzahlungsfrist
"""
import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

logger = logging.getLogger("bidblitz.instant_credit")
router = APIRouter(prefix="/api/instant-credit", tags=["instant-credit"])

MAX_LIMIT_EUR = 100.0
PROCESSING_FEE = 1.99
PREMIUM_FEE = 0.0
REPAYMENT_DAYS = 30
COOLDOWN_HOURS = 24  # nach Rückzahlung 24h warten


# ═══════════════════════════════════════════════════════════════════════════════
# Eligibility (KYC + nicht-aktiver Kredit + Cooldown + Score-Check)
# ═══════════════════════════════════════════════════════════════════════════════

async def _calculate_credit_score(user_id: str, user: dict) -> dict:
    """Score 0-100 basierend auf Account-Aktivität → Kreditlimit."""
    age_days = 0
    if user.get("created_at"):
        try:
            created = datetime.fromisoformat(user["created_at"].replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - created).days
        except Exception:
            pass

    tx_count = await db.transactions.count_documents({"user_id": user_id, "status": "completed"})
    successful_repayments = await db.instant_credits.count_documents(
        {"user_id": user_id, "status": "repaid"}
    )
    kyc_verified = (user.get("kyc_status") == "approved")

    # Score
    score = 0
    if kyc_verified: score += 30
    score += min(20, age_days // 7)              # max 20 für 140+ Tage
    score += min(20, tx_count)                    # max 20 für 20+ Transaktionen
    score += min(30, successful_repayments * 10)  # max 30 für 3+ Rückzahlungen

    # Limit basierend auf Score
    if score >= 70: limit = 100.0
    elif score >= 50: limit = 50.0
    elif score >= 30: limit = 25.0
    else: limit = 0.0

    return {
        "score": score,
        "limit": limit,
        "kyc_verified": kyc_verified,
        "account_age_days": age_days,
        "transactions_count": tx_count,
        "previous_loans_repaid": successful_repayments,
    }


@router.get("/eligibility")
async def check_eligibility(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))

    # 1) Existing active loan?
    active = await db.instant_credits.find_one(
        {"user_id": uid, "status": {"$in": ["active", "pending"]}}, {"_id": 0}
    )
    if active:
        return {
            "eligible": False,
            "reason": "active_loan",
            "active_loan": active,
            "message": "Bitte zuerst aktuellen Kredit zurückzahlen",
        }

    # 2) Cooldown nach letzter Rückzahlung
    last = await db.instant_credits.find_one(
        {"user_id": uid, "status": "repaid"}, {"_id": 0}, sort=[("repaid_at", -1)]
    )
    if last and last.get("repaid_at"):
        try:
            repaid = datetime.fromisoformat(last["repaid_at"])
            hours_since = (datetime.now(timezone.utc) - repaid).total_seconds() / 3600
            if hours_since < COOLDOWN_HOURS:
                hours_left = round(COOLDOWN_HOURS - hours_since, 1)
                return {
                    "eligible": False,
                    "reason": "cooldown",
                    "hours_left": hours_left,
                    "message": f"Du kannst in {hours_left}h den nächsten Kredit anfordern",
                }
        except Exception:
            pass

    # 3) Score
    score_data = await _calculate_credit_score(uid, user)
    if score_data["limit"] <= 0:
        return {
            "eligible": False,
            "reason": "score_too_low",
            "score": score_data,
            "message": "Erhöhe deinen Score: KYC verifizieren, Transaktionen tätigen",
        }

    is_premium = bool(user.get("is_premium") or False)
    fee = PREMIUM_FEE if is_premium else PROCESSING_FEE

    return {
        "eligible": True,
        "max_amount_eur": score_data["limit"],
        "fee_eur": fee,
        "is_premium": is_premium,
        "interest_rate": 0.0,
        "repayment_days": REPAYMENT_DAYS,
        "processing_minutes": 3,
        "score": score_data,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Request Loan
# ═══════════════════════════════════════════════════════════════════════════════

class LoanRequest(BaseModel):
    amount_eur: float = Field(ge=10.0, le=MAX_LIMIT_EUR)


@router.post("/request")
async def request_loan(req: LoanRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))

    # Re-check eligibility
    elig = await check_eligibility(request)
    if not elig.get("eligible"):
        raise HTTPException(400, elig.get("message", "Nicht berechtigt"))

    if req.amount_eur > elig["max_amount_eur"]:
        raise HTTPException(400, f"Maximaler Kreditbetrag: {elig['max_amount_eur']:.2f}€")

    is_premium = elig["is_premium"]
    fee = PREMIUM_FEE if is_premium else PROCESSING_FEE
    now = datetime.now(timezone.utc)
    loan_id = f"loan_{secrets.token_hex(8)}"
    due_date = (now + timedelta(days=REPAYMENT_DAYS)).isoformat()
    payout_at = (now + timedelta(minutes=3)).isoformat()  # 3-Minuten-Auszahlung

    loan = {
        "loan_id": loan_id,
        "user_id": uid,
        "amount_eur": req.amount_eur,
        "fee_eur": fee,
        "total_repayment_eur": req.amount_eur + 0,  # 0% Zinsen
        "outstanding_eur": req.amount_eur,
        "interest_rate": 0.0,
        "status": "pending",   # pending → active → repaid
        "requested_at": now.isoformat(),
        "payout_at": payout_at,
        "due_at": due_date,
        "is_premium": is_premium,
        "score_at_request": elig["score"]["score"],
        "auto_repay_enabled": True,
    }
    await db.instant_credits.insert_one(loan)
    loan.pop("_id", None)

    return {"ok": True, "loan": loan, "message": "Kredit wird in 3 Minuten ausgezahlt"}


# ═══════════════════════════════════════════════════════════════════════════════
# Active Loan Status
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/active")
async def get_active_loan(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    loan = await db.instant_credits.find_one(
        {"user_id": uid, "status": {"$in": ["active", "pending"]}}, {"_id": 0}
    )
    if not loan:
        return {"loan": None}

    # Berechne Sekunden bis Auszahlung (für pending)
    if loan["status"] == "pending":
        try:
            payout = datetime.fromisoformat(loan["payout_at"])
            seconds_left = max(0, int((payout - datetime.now(timezone.utc)).total_seconds()))
            loan["seconds_until_payout"] = seconds_left
        except Exception:
            loan["seconds_until_payout"] = 0

    if loan["status"] == "active":
        try:
            due = datetime.fromisoformat(loan["due_at"])
            days_left = max(0, (due - datetime.now(timezone.utc)).days)
            loan["days_until_due"] = days_left
        except Exception:
            loan["days_until_due"] = 0

    return {"loan": loan}


# ═══════════════════════════════════════════════════════════════════════════════
# Manual Repayment
# ═══════════════════════════════════════════════════════════════════════════════

class RepayRequest(BaseModel):
    loan_id: str
    amount_eur: Optional[float] = None  # None = full repayment


@router.post("/repay")
async def repay_loan(req: RepayRequest, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    loan = await db.instant_credits.find_one(
        {"loan_id": req.loan_id, "user_id": uid, "status": "active"}, {"_id": 0}
    )
    if not loan:
        raise HTTPException(404, "Aktiver Kredit nicht gefunden")

    outstanding = float(loan.get("outstanding_eur", 0))
    repay_amount = float(req.amount_eur) if req.amount_eur else outstanding
    repay_amount = min(repay_amount, outstanding)

    user_balance = float(user.get("balance", 0) or 0)
    if user_balance < repay_amount:
        raise HTTPException(400, f"Zu wenig Guthaben (benötigt {repay_amount:.2f}€)")

    now = datetime.now(timezone.utc).isoformat()

    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -repay_amount}})

    new_outstanding = outstanding - repay_amount
    update = {"outstanding_eur": new_outstanding, "last_payment_at": now}
    if new_outstanding <= 0.01:
        update["status"] = "repaid"
        update["repaid_at"] = now

    await db.instant_credits.update_one({"loan_id": req.loan_id}, {"$set": update})
    await db.instant_credit_payments.insert_one({
        "loan_id": req.loan_id, "user_id": uid,
        "amount_eur": repay_amount, "type": "manual",
        "created_at": now,
    })

    return {
        "ok": True, "repaid_eur": repay_amount,
        "outstanding_eur": new_outstanding,
        "fully_repaid": new_outstanding <= 0.01,
    }


@router.get("/history")
async def loan_history(request: Request, limit: int = 20):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    loans = await db.instant_credits.find(
        {"user_id": uid}, {"_id": 0}
    ).sort("requested_at", -1).limit(min(limit, 100)).to_list(100)
    return {"loans": loans, "count": len(loans)}


# ═══════════════════════════════════════════════════════════════════════════════
# Background Loops
# ═══════════════════════════════════════════════════════════════════════════════
import asyncio


async def payout_loop():
    """Zahle pending loans nach 3 Min aus + sende Push."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()
            pending = await db.instant_credits.find(
                {"status": "pending", "payout_at": {"$lte": now_iso}}, {"_id": 0}
            ).to_list(100)

            for loan in pending:
                # Credit user wallet (amount minus fee)
                payout_amount = loan["amount_eur"] - loan["fee_eur"]
                from bson import ObjectId
                try:
                    await db.users.update_one(
                        {"_id": ObjectId(loan["user_id"])},
                        {"$inc": {"balance": payout_amount}},
                    )
                except Exception:
                    continue

                await db.instant_credits.update_one(
                    {"loan_id": loan["loan_id"]},
                    {"$set": {"status": "active", "payout_completed_at": now_iso}},
                )
                await db.transactions.insert_one({
                    "user_id": loan["user_id"], "type": "credit",
                    "amount": payout_amount, "currency": "EUR",
                    "status": "completed",
                    "description": f"Sofort-Kredit ({loan['amount_eur']:.2f}€ - {loan['fee_eur']:.2f}€ Gebühr)",
                    "category": "instant_credit",
                    "reference": loan["loan_id"],
                    "created_at": now_iso, "date": now_iso,
                })

                try:
                    from routes.web_push import send_push_to_user
                    asyncio.create_task(send_push_to_user(
                        user_id=loan["user_id"],
                        title="💸 Kredit ausgezahlt!",
                        body=f"{payout_amount:.2f}€ sind in deinem Wallet",
                        data={"type": "credit_payout", "loan_id": loan["loan_id"]},
                    ))
                except Exception:
                    pass
        except Exception as e:
            logger.error(f"Payout loop error: {e}")
        await asyncio.sleep(20)  # alle 20s


async def overdue_loop():
    """Erinnere User an überfällige Kredite."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()
            overdue = await db.instant_credits.find(
                {"status": "active", "due_at": {"$lt": now_iso}}, {"_id": 0}
            ).to_list(100)
            for loan in overdue:
                last_remind = loan.get("last_overdue_reminder")
                if last_remind:
                    try:
                        d = datetime.fromisoformat(last_remind)
                        if (now - d).total_seconds() < 86400:
                            continue
                    except Exception:
                        pass
                try:
                    from routes.web_push import send_push_to_user
                    asyncio.create_task(send_push_to_user(
                        user_id=loan["user_id"],
                        title="⏰ Kredit-Rückzahlung fällig",
                        body=f"Bitte {loan.get('outstanding_eur', 0):.2f}€ zurückzahlen",
                        data={"type": "credit_overdue", "loan_id": loan["loan_id"]},
                    ))
                except Exception:
                    pass
                await db.instant_credits.update_one(
                    {"loan_id": loan["loan_id"]},
                    {"$set": {"last_overdue_reminder": now_iso}},
                )
        except Exception as e:
            logger.error(f"Overdue loop error: {e}")
        await asyncio.sleep(3600)  # alle 1h


def start_instant_credit_loops():
    asyncio.create_task(payout_loop())
    asyncio.create_task(overdue_loop())
