"""
Partner Stripe Connect - Automatic payouts for partners
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import os
import stripe

from config import db, logger

router = APIRouter(prefix="/partner-stripe", tags=["Partner Stripe Connect"])

# Initialize Stripe
stripe.api_key = os.environ.get("STRIPE_API_KEY")

class ConnectAccountRequest(BaseModel):
    return_url: str
    refresh_url: str

class PayoutRequest(BaseModel):
    amount: Optional[float] = None

# ==================== STRIPE CONNECT ACCOUNT ====================

@router.post("/create-connect-account")
async def create_connect_account(token: str, data: ConnectAccountRequest):
    """Create a Stripe Connect Express account for a partner"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    # Check if partner already has a Stripe account
    if partner.get("stripe_account_id"):
        # Return account link for existing account
        try:
            account_link = stripe.AccountLink.create(
                account=partner["stripe_account_id"],
                refresh_url=data.refresh_url,
                return_url=data.return_url,
                type="account_onboarding"
            )
            return {
                "url": account_link.url,
                "account_id": partner["stripe_account_id"],
                "existing": True
            }
        except stripe.error.InvalidRequestError:
            # Account was deleted, create new one
            pass
    
    try:
        # Create Express Connect account
        account = stripe.Account.create(
            type="express",
            country="DE",  # Germany
            email=partner["email"],
            capabilities={
                "transfers": {"requested": True},
            },
            business_type="company",
            metadata={
                "partner_id": partner["id"],
                "business_name": partner.get("business_name", "")
            }
        )
        
        # Store account ID
        partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
        await partner_collection.update_one(
            {"id": partner["id"]},
            {"$set": {
                "stripe_account_id": account.id,
                "stripe_onboarding_complete": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Create account link for onboarding
        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=data.refresh_url,
            return_url=data.return_url,
            type="account_onboarding"
        )
        
        logger.info(f"Created Stripe Connect account {account.id} for partner {partner['id']}")
        
        return {
            "url": account_link.url,
            "account_id": account.id,
            "existing": False
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating connect account: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/account-status")
async def get_account_status(token: str):
    """Get Stripe Connect account status"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    stripe_account_id = partner.get("stripe_account_id")
    
    if not stripe_account_id:
        return {
            "connected": False,
            "onboarding_complete": False,
            "payouts_enabled": False,
            "charges_enabled": False
        }
    
    try:
        account = stripe.Account.retrieve(stripe_account_id)
        
        # Update onboarding status
        if account.details_submitted and not partner.get("stripe_onboarding_complete"):
            partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
            await partner_collection.update_one(
                {"id": partner["id"]},
                {"$set": {
                    "stripe_onboarding_complete": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return {
            "connected": True,
            "account_id": stripe_account_id,
            "onboarding_complete": account.details_submitted,
            "payouts_enabled": account.payouts_enabled,
            "charges_enabled": account.charges_enabled,
            "country": account.country,
            "default_currency": account.default_currency
        }
        
    except stripe.error.InvalidRequestError:
        return {
            "connected": False,
            "onboarding_complete": False,
            "payouts_enabled": False,
            "error": "Account not found"
        }

@router.post("/request-payout")
async def request_stripe_payout(token: str, data: PayoutRequest):
    """Request automatic payout via Stripe Connect"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    stripe_account_id = partner.get("stripe_account_id")
    if not stripe_account_id:
        raise HTTPException(status_code=400, detail="Bitte verbinden Sie zuerst Ihr Stripe-Konto")
    
    # Check account status
    try:
        account = stripe.Account.retrieve(stripe_account_id)
        if not account.payouts_enabled:
            raise HTTPException(status_code=400, detail="Stripe-Konto ist noch nicht bereit fuer Auszahlungen")
    except stripe.error.InvalidRequestError:
        raise HTTPException(status_code=400, detail="Stripe-Konto nicht gefunden")
    
    pending = partner.get("pending_payout", 0)
    min_payout = 50.0
    
    amount = data.amount or pending
    
    if amount > pending:
        raise HTTPException(status_code=400, detail=f"Maximaler Betrag: EUR {pending:.2f}")
    
    if amount < min_payout:
        raise HTTPException(status_code=400, detail=f"Mindestbetrag: EUR {min_payout:.2f}")
    
    try:
        # Create transfer to connected account
        transfer = stripe.Transfer.create(
            amount=int(amount * 100),  # Convert to cents
            currency="eur",
            destination=stripe_account_id,
            metadata={
                "partner_id": partner["id"],
                "business_name": partner.get("business_name", "")
            }
        )
        
        payout_id = f"PAY-{transfer.id[-8:].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        
        # Record payout
        payout_record = {
            "id": payout_id,
            "stripe_transfer_id": transfer.id,
            "partner_id": partner["id"],
            "amount": amount,
            "status": "completed",
            "method": "stripe_connect",
            "requested_at": now,
            "completed_at": now
        }
        
        await db.partner_payouts.insert_one(payout_record)
        
        # Update partner balance
        partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
        await partner_collection.update_one(
            {"id": partner["id"]},
            {
                "$inc": {
                    "pending_payout": -amount,
                    "total_payout": amount
                },
                "$push": {
                    "payout_requests": {
                        "id": payout_id,
                        "amount": amount,
                        "status": "completed",
                        "method": "stripe_connect",
                        "requested_at": now
                    }
                }
            }
        )
        
        logger.info(f"Stripe payout {transfer.id} for partner {partner['id']}: EUR {amount}")
        
        return {
            "success": True,
            "message": f"Auszahlung von EUR {amount:.2f} erfolgreich!",
            "payout_id": payout_id,
            "stripe_transfer_id": transfer.id,
            "amount": amount,
            "remaining_balance": pending - amount
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe payout error: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe-Fehler: {str(e)}")

@router.get("/payout-history")
async def get_stripe_payout_history(token: str, limit: int = 20):
    """Get payout history with Stripe transfer details"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    payouts = await db.partner_payouts.find(
        {"partner_id": partner["id"]},
        {"_id": 0}
    ).sort("requested_at", -1).limit(limit).to_list(limit)
    
    return {
        "payouts": payouts,
        "total": len(payouts),
        "pending_balance": partner.get("pending_payout", 0),
        "total_paid": partner.get("total_payout", 0)
    }

@router.post("/disconnect")
async def disconnect_stripe_account(token: str):
    """Disconnect Stripe Connect account"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    stripe_account_id = partner.get("stripe_account_id")
    if not stripe_account_id:
        raise HTTPException(status_code=400, detail="Kein Stripe-Konto verbunden")
    
    # Remove from database (don't delete Stripe account)
    partner_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner["id"]}) else db.restaurant_accounts
    await partner_collection.update_one(
        {"id": partner["id"]},
        {"$unset": {
            "stripe_account_id": "",
            "stripe_onboarding_complete": ""
        }}
    )
    
    logger.info(f"Partner {partner['id']} disconnected Stripe account {stripe_account_id}")
    
    return {
        "success": True,
        "message": "Stripe-Konto getrennt"
    }

partner_stripe_router = router
