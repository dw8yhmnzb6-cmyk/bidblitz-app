"""
BidBlitz V2 — Stripe Connect for Merchant Payouts
Express accounts, onboarding, earnings tracking.
"""
import secrets
import logging
import stripe as stripe_mod
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from core.config import STRIPE_API_KEY
from core.database import db

router = APIRouter(prefix="/api/merchant-connect", tags=["MerchantConnect"])
logger = logging.getLogger("bidblitz.merchant_connect")

stripe_mod.api_key = STRIPE_API_KEY


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


# ── Models ──
class CreateConnectAccountReq(BaseModel):
    business_name: str = ""


class UpdatePayoutScheduleReq(BaseModel):
    interval: str = "daily"  # daily, weekly, monthly, manual


# ── Create Express Connected Account ──
@router.post("/create-account")
async def create_connect_account(req: CreateConnectAccountReq, request: Request):
    """Start Stripe Connect onboarding for a merchant."""
    user = await get_current_user(request)

    # Check if already has a connect account
    existing = user.get("stripe_connect_id")
    if existing:
        # Generate new onboarding link
        try:
            link = stripe_mod.AccountLink.create(
                account=existing,
                type="account_onboarding",
                refresh_url="https://bidblitz.ae/merchant/onboarding?refresh=1",
                return_url="https://bidblitz.ae/merchant/onboarding?complete=1",
            )
            return {"account_id": existing, "onboarding_url": link.url, "existing": True}
        except Exception:
            pass

    # Create new Express account
    try:
        account = stripe_mod.Account.create(
            type="express",
            country="DE",
            email=user.get("email", ""),
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
            business_type="individual",
            business_profile={
                "url": "https://bidblitz.ae",
                "name": req.business_name or user.get("name", "Merchant"),
            },
            settings={
                "payouts": {"schedule": {"interval": "daily"}},
            },
        )
    except Exception as e:
        logger.error(f"Stripe Connect account creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create merchant account")

    # Save to user
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "stripe_connect_id": account.id,
            "stripe_connect_status": "pending",
            "stripe_connect_created": datetime.now(timezone.utc).isoformat(),
            "merchant_business_name": req.business_name or user.get("name", ""),
        }},
    )

    # Create onboarding link
    link = stripe_mod.AccountLink.create(
        account=account.id,
        type="account_onboarding",
        refresh_url="https://bidblitz.ae/merchant/onboarding?refresh=1",
        return_url="https://bidblitz.ae/merchant/onboarding?complete=1",
    )

    return {"account_id": account.id, "onboarding_url": link.url, "existing": False}


# ── Check Connect Account Status ──
@router.get("/status")
async def get_connect_status(request: Request):
    """Get merchant's Stripe Connect account status."""
    user = await get_current_user(request)
    connect_id = user.get("stripe_connect_id")

    if not connect_id:
        return {"connected": False, "status": "none"}

    try:
        account = stripe_mod.Account.retrieve(connect_id)
        status = "active" if account.charges_enabled and account.payouts_enabled else "pending"

        # Update DB
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "stripe_connect_status": status,
                "stripe_connect_charges": account.charges_enabled,
                "stripe_connect_payouts": account.payouts_enabled,
            }},
        )

        return {
            "connected": True,
            "account_id": connect_id,
            "status": status,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
            "details_submitted": account.details_submitted,
            "requirements": {
                "currently_due": account.requirements.currently_due if account.requirements else [],
                "past_due": account.requirements.past_due if account.requirements else [],
            },
        }
    except Exception as e:
        logger.error(f"Error retrieving connect account: {e}")
        return {"connected": True, "account_id": connect_id, "status": "error"}


# ── Get Merchant Earnings ──
@router.get("/earnings")
async def get_merchant_earnings(request: Request):
    """Get merchant's earnings summary from auction wins."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Aggregate from transactions
    total_earned = 0
    pending_payout = 0
    total_paid = 0

    txns = await db.merchant_earnings.find(
        {"merchant_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    for t in txns:
        total_earned += t.get("amount", 0)
        if t.get("status") == "pending":
            pending_payout += t.get("amount", 0)
        elif t.get("status") == "paid":
            total_paid += t.get("amount", 0)

    return {
        "total_earned": round(total_earned, 2),
        "pending_payout": round(pending_payout, 2),
        "total_paid_out": round(total_paid, 2),
        "recent_transactions": txns[:10],
    }


# ── List Connected Merchants (Admin) ──
@router.get("/admin/merchants")
async def list_connected_merchants(request: Request):
    """Admin: List all merchants with Stripe Connect."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    merchants = await db.users.find(
        {"stripe_connect_id": {"$exists": True}},
        {"_id": 0, "password": 0, "email": 1, "name": 1, "stripe_connect_id": 1,
         "stripe_connect_status": 1, "merchant_business_name": 1, "stripe_connect_created": 1},
    ).to_list(100)

    return {"merchants": merchants, "total": len(merchants)}
