"""
Partner Voucher Budget System
- Admin can give merchants free voucher credit (Freibetrag)
- Merchants can top up their voucher budget via Wise payment
- Tracks voucher creation against available budget
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from config import db, logger

router = APIRouter(prefix="/partner-budget", tags=["Partner Budget"])

# Wise account details (Admin configurable)
WISE_ACCOUNT = {
    "account_holder": "BidBlitz GmbH",
    "iban": os.environ.get("WISE_IBAN", "DE89370400440532013000"),  # Placeholder - Admin should set real IBAN
    "bic": os.environ.get("WISE_BIC", "COBADEFFXXX"),
    "bank_name": "Wise (TransferWise)",
    "reference_prefix": "BIDBLITZ-"
}


# ==================== SCHEMAS ====================

class SetFreibetragRequest(BaseModel):
    partner_id: str
    amount: float  # Free voucher credit amount
    note: Optional[str] = None


class TopUpRequest(BaseModel):
    amount: float
    payment_reference: Optional[str] = None


class ConfirmPaymentRequest(BaseModel):
    partner_id: str
    amount: float
    transaction_reference: str
    note: Optional[str] = None


class PayoutSettingsRequest(BaseModel):
    payout_frequency: str  # 'daily', 'weekly', 'monthly', 'manual'
    min_payout_amount: Optional[float] = 50.0
    wise_email: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_holder_name: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================

async def get_partner_from_token(token: str):
    """Get partner from auth token"""
    if not token:
        return None
    partner = await db.partners.find_one({"auth_token": token}, {"_id": 0})
    return partner


async def get_partner_budget(partner_id: str):
    """Get or create partner budget record"""
    budget = await db.partner_budgets.find_one({"partner_id": partner_id}, {"_id": 0})
    
    if not budget:
        # Create default budget
        budget = {
            "partner_id": partner_id,
            "voucher_budget": 0.0,  # Available voucher creation budget
            "freibetrag": 0.0,  # Free credit given by admin
            "freibetrag_used": 0.0,  # How much of freibetrag has been used
            "paid_credit": 0.0,  # Credit from payments
            "total_vouchers_created": 0.0,  # Total value of vouchers created
            "earnings_balance": 0.0,  # Earnings from customer payments (to be paid out)
            "total_earnings": 0.0,  # All-time earnings
            "total_paid_out": 0.0,  # Total amount paid out to merchant
            "payout_frequency": "weekly",  # daily, weekly, monthly, manual
            "min_payout_amount": 50.0,
            "next_payout_date": None,
            "wise_email": None,
            "bank_iban": None,
            "bank_holder_name": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.partner_budgets.insert_one(budget)
    
    return budget


# ==================== PARTNER ENDPOINTS ====================

@router.get("/my-budget")
async def get_my_budget(token: str):
    """Get current partner's budget and earnings"""
    partner = await get_partner_from_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Nicht autorisiert")
    
    budget = await get_partner_budget(partner["id"])
    
    # Calculate available voucher budget
    freibetrag_remaining = max(0, budget.get("freibetrag", 0) - budget.get("freibetrag_used", 0))
    paid_remaining = budget.get("paid_credit", 0)
    total_available = freibetrag_remaining + paid_remaining
    
    return {
        "voucher_budget": {
            "total_available": total_available,
            "freibetrag_remaining": freibetrag_remaining,
            "paid_credit": paid_remaining,
            "freibetrag_total": budget.get("freibetrag", 0),
            "freibetrag_used": budget.get("freibetrag_used", 0)
        },
        "earnings": {
            "available_for_payout": budget.get("earnings_balance", 0),
            "total_earnings": budget.get("total_earnings", 0),
            "total_paid_out": budget.get("total_paid_out", 0)
        },
        "payout_settings": {
            "frequency": budget.get("payout_frequency", "weekly"),
            "min_amount": budget.get("min_payout_amount", 50.0),
            "next_payout": budget.get("next_payout_date"),
            "wise_email": budget.get("wise_email"),
            "bank_iban": budget.get("bank_iban"),
            "bank_holder_name": budget.get("bank_holder_name")
        },
        "can_create_vouchers": total_available > 0
    }


@router.get("/wise-payment-details")
async def get_wise_payment_details(token: str, amount: float):
    """Get Wise bank details for merchant to pay BidBlitz"""
    partner = await get_partner_from_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Nicht autorisiert")
    
    # Generate unique payment reference
    reference = f"{WISE_ACCOUNT['reference_prefix']}{partner['id'][:8].upper()}-{uuid.uuid4().hex[:6].upper()}"
    
    # Store pending payment request
    payment_request = {
        "id": str(uuid.uuid4()),
        "partner_id": partner["id"],
        "partner_name": partner.get("company_name") or partner.get("business_name"),
        "amount": amount,
        "reference": reference,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.partner_payment_requests.insert_one(payment_request)
    
    return {
        "payment_details": {
            "account_holder": WISE_ACCOUNT["account_holder"],
            "iban": WISE_ACCOUNT["iban"],
            "bic": WISE_ACCOUNT["bic"],
            "bank_name": WISE_ACCOUNT["bank_name"],
            "amount": amount,
            "currency": "EUR",
            "reference": reference
        },
        "instructions": {
            "de": f"Bitte überweisen Sie €{amount:.2f} an die oben genannten Bankdaten. Verwenden Sie unbedingt die Referenz '{reference}' im Verwendungszweck. Nach Zahlungseingang wird Ihr Guthaben automatisch aktiviert.",
            "en": f"Please transfer €{amount:.2f} to the bank details above. Make sure to use the reference '{reference}' in the payment description. Your credit will be activated after payment is received."
        },
        "request_id": payment_request["id"]
    }


@router.post("/update-payout-settings")
async def update_payout_settings(token: str, settings: PayoutSettingsRequest):
    """Update merchant's payout preferences"""
    partner = await get_partner_from_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Nicht autorisiert")
    
    # Validate frequency
    valid_frequencies = ["daily", "weekly", "monthly", "manual"]
    if settings.payout_frequency not in valid_frequencies:
        raise HTTPException(status_code=400, detail="Ungültige Auszahlungsfrequenz")
    
    # Update budget settings
    update_data = {
        "payout_frequency": settings.payout_frequency,
        "min_payout_amount": settings.min_payout_amount or 50.0,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if settings.wise_email:
        update_data["wise_email"] = settings.wise_email
    if settings.bank_iban:
        update_data["bank_iban"] = settings.bank_iban
    if settings.bank_holder_name:
        update_data["bank_holder_name"] = settings.bank_holder_name
    
    await db.partner_budgets.update_one(
        {"partner_id": partner["id"]},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True, "message": "Auszahlungseinstellungen aktualisiert"}


@router.post("/request-payout")
async def request_manual_payout(token: str):
    """Request manual payout of available earnings"""
    partner = await get_partner_from_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Nicht autorisiert")
    
    budget = await get_partner_budget(partner["id"])
    available = budget.get("earnings_balance", 0)
    min_amount = budget.get("min_payout_amount", 50.0)
    
    if available < min_amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Mindestbetrag für Auszahlung: €{min_amount:.2f}. Verfügbar: €{available:.2f}"
        )
    
    # Create payout request
    payout_request = {
        "id": str(uuid.uuid4()),
        "partner_id": partner["id"],
        "partner_name": partner.get("company_name") or partner.get("business_name"),
        "amount": available,
        "status": "pending",
        "wise_email": budget.get("wise_email"),
        "bank_iban": budget.get("bank_iban"),
        "bank_holder_name": budget.get("bank_holder_name"),
        "created_at": datetime.now(timezone.utc)
    }
    await db.partner_payout_requests.insert_one(payout_request)
    
    return {
        "success": True,
        "message": f"Auszahlung von €{available:.2f} beantragt",
        "payout_id": payout_request["id"],
        "amount": available
    }


@router.get("/my-payment-history")
async def get_payment_history(token: str, limit: int = 20):
    """Get merchant's payment and payout history"""
    partner = await get_partner_from_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Nicht autorisiert")
    
    # Get payment requests (money paid TO BidBlitz)
    payments = await db.partner_payment_requests.find(
        {"partner_id": partner["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    # Get payout requests (money paid FROM BidBlitz)
    payouts = await db.partner_payout_requests.find(
        {"partner_id": partner["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    return {
        "payments_to_bidblitz": payments,
        "payouts_from_bidblitz": payouts
    }


# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/set-freibetrag")
async def admin_set_freibetrag(token: str, request: SetFreibetragRequest):
    """Admin: Set free voucher credit for a partner"""
    # Verify admin
    admin = await db.users.find_one({"auth_token": token, "is_admin": True})
    if not admin:
        # Try partner admin
        partner_admin = await db.partners.find_one({"auth_token": token, "role": "admin"})
        if not partner_admin:
            raise HTTPException(status_code=403, detail="Admin-Zugriff erforderlich")
    
    # Get partner
    partner = await db.partners.find_one({"id": request.partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner nicht gefunden")
    
    # Update budget
    budget = await get_partner_budget(request.partner_id)
    
    await db.partner_budgets.update_one(
        {"partner_id": request.partner_id},
        {
            "$set": {
                "freibetrag": request.amount,
                "freibetrag_used": 0,  # Reset used amount when setting new freibetrag
                "updated_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    # Log the action
    await db.partner_budget_logs.insert_one({
        "partner_id": request.partner_id,
        "action": "freibetrag_set",
        "amount": request.amount,
        "note": request.note,
        "admin_id": admin.get("id") if admin else "partner_admin",
        "created_at": datetime.now(timezone.utc)
    })
    
    logger.info(f"Freibetrag set for partner {request.partner_id}: €{request.amount}")
    
    return {
        "success": True,
        "message": f"Freibetrag von €{request.amount:.2f} für {partner.get('company_name', partner.get('business_name'))} gesetzt",
        "partner_id": request.partner_id,
        "new_freibetrag": request.amount
    }


@router.post("/admin/confirm-payment")
async def admin_confirm_payment(token: str, request: ConfirmPaymentRequest):
    """Admin: Confirm a payment received from partner"""
    # Verify admin
    admin = await db.users.find_one({"auth_token": token, "is_admin": True})
    if not admin:
        raise HTTPException(status_code=403, detail="Admin-Zugriff erforderlich")
    
    # Get partner
    partner = await db.partners.find_one({"id": request.partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner nicht gefunden")
    
    # Update budget - add paid credit
    await db.partner_budgets.update_one(
        {"partner_id": request.partner_id},
        {
            "$inc": {"paid_credit": request.amount},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        },
        upsert=True
    )
    
    # Update payment request status if exists
    await db.partner_payment_requests.update_one(
        {"partner_id": request.partner_id, "reference": request.transaction_reference},
        {
            "$set": {
                "status": "confirmed",
                "confirmed_at": datetime.now(timezone.utc),
                "confirmed_by": admin.get("id")
            }
        }
    )
    
    # Log the action
    await db.partner_budget_logs.insert_one({
        "partner_id": request.partner_id,
        "action": "payment_confirmed",
        "amount": request.amount,
        "reference": request.transaction_reference,
        "note": request.note,
        "admin_id": admin.get("id"),
        "created_at": datetime.now(timezone.utc)
    })
    
    logger.info(f"Payment confirmed for partner {request.partner_id}: €{request.amount}")
    
    return {
        "success": True,
        "message": f"Zahlung von €{request.amount:.2f} bestätigt",
        "partner_id": request.partner_id
    }


@router.post("/admin/process-payout")
async def admin_process_payout(token: str, payout_id: str, transaction_reference: str):
    """Admin: Mark a payout as processed"""
    # Verify admin
    admin = await db.users.find_one({"auth_token": token, "is_admin": True})
    if not admin:
        raise HTTPException(status_code=403, detail="Admin-Zugriff erforderlich")
    
    # Get payout request
    payout = await db.partner_payout_requests.find_one({"id": payout_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Auszahlungsanfrage nicht gefunden")
    
    if payout.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Auszahlung bereits verarbeitet")
    
    # Update payout status
    await db.partner_payout_requests.update_one(
        {"id": payout_id},
        {
            "$set": {
                "status": "completed",
                "transaction_reference": transaction_reference,
                "processed_at": datetime.now(timezone.utc),
                "processed_by": admin.get("id")
            }
        }
    )
    
    # Update partner budget
    await db.partner_budgets.update_one(
        {"partner_id": payout["partner_id"]},
        {
            "$inc": {
                "earnings_balance": -payout["amount"],
                "total_paid_out": payout["amount"]
            },
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    logger.info(f"Payout processed for partner {payout['partner_id']}: €{payout['amount']}")
    
    return {
        "success": True,
        "message": f"Auszahlung von €{payout['amount']:.2f} verarbeitet"
    }


@router.get("/admin/pending-payments")
async def admin_get_pending_payments(token: str):
    """Admin: Get all pending payment requests from partners"""
    # Verify admin
    admin = await db.users.find_one({"auth_token": token, "is_admin": True})
    if not admin:
        raise HTTPException(status_code=403, detail="Admin-Zugriff erforderlich")
    
    payments = await db.partner_payment_requests.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    
    return {"pending_payments": payments}


@router.get("/admin/pending-payouts")
async def admin_get_pending_payouts(token: str):
    """Admin: Get all pending payout requests"""
    # Verify admin
    admin = await db.users.find_one({"auth_token": token, "is_admin": True})
    if not admin:
        raise HTTPException(status_code=403, detail="Admin-Zugriff erforderlich")
    
    payouts = await db.partner_payout_requests.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    
    return {"pending_payouts": payouts}


@router.get("/admin/partner-budgets")
async def admin_get_all_budgets(token: str):
    """Admin: Get all partner budgets overview"""
    # Verify admin
    admin = await db.users.find_one({"auth_token": token, "is_admin": True})
    if not admin:
        raise HTTPException(status_code=403, detail="Admin-Zugriff erforderlich")
    
    # Get all budgets with partner info
    budgets = await db.partner_budgets.find({}, {"_id": 0}).to_list(length=500)
    
    # Enrich with partner names
    for budget in budgets:
        partner = await db.partners.find_one({"id": budget["partner_id"]}, {"_id": 0})
        if partner:
            budget["partner_name"] = partner.get("company_name") or partner.get("business_name")
            budget["partner_email"] = partner.get("email")
    
    # Calculate totals
    total_freibetrag = sum(b.get("freibetrag", 0) for b in budgets)
    total_paid_credit = sum(b.get("paid_credit", 0) for b in budgets)
    total_earnings_pending = sum(b.get("earnings_balance", 0) for b in budgets)
    total_paid_out = sum(b.get("total_paid_out", 0) for b in budgets)
    
    return {
        "budgets": budgets,
        "totals": {
            "total_freibetrag_given": total_freibetrag,
            "total_paid_credit": total_paid_credit,
            "total_earnings_pending": total_earnings_pending,
            "total_paid_out": total_paid_out
        }
    }


# ==================== VOUCHER BUDGET DEDUCTION ====================

async def deduct_voucher_budget(partner_id: str, amount: float) -> bool:
    """
    Deduct from partner's voucher budget when creating vouchers.
    First uses freibetrag, then paid_credit.
    Returns True if successful, False if insufficient budget.
    """
    budget = await get_partner_budget(partner_id)
    
    freibetrag_remaining = max(0, budget.get("freibetrag", 0) - budget.get("freibetrag_used", 0))
    paid_credit = budget.get("paid_credit", 0)
    total_available = freibetrag_remaining + paid_credit
    
    if amount > total_available:
        return False
    
    # Deduct from freibetrag first
    freibetrag_deduction = min(amount, freibetrag_remaining)
    paid_deduction = amount - freibetrag_deduction
    
    await db.partner_budgets.update_one(
        {"partner_id": partner_id},
        {
            "$inc": {
                "freibetrag_used": freibetrag_deduction,
                "paid_credit": -paid_deduction,
                "total_vouchers_created": amount
            },
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return True


async def add_partner_earnings(partner_id: str, amount: float, commission_rate: float = 2.0):
    """
    Add earnings to partner's balance when customer pays.
    Deducts BidBlitz commission.
    """
    commission = amount * (commission_rate / 100)
    net_amount = amount - commission
    
    await db.partner_budgets.update_one(
        {"partner_id": partner_id},
        {
            "$inc": {
                "earnings_balance": net_amount,
                "total_earnings": net_amount
            },
            "$set": {"updated_at": datetime.now(timezone.utc)}
        },
        upsert=True
    )
    
    # Log commission for BidBlitz
    await db.platform_commissions.insert_one({
        "partner_id": partner_id,
        "transaction_amount": amount,
        "commission_rate": commission_rate,
        "commission_amount": commission,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"net_amount": net_amount, "commission": commission}
