"""
Wise (TransferWise) Payouts - Alternative to Stripe Connect for Partner Payouts
Provides automated bank transfers to partners using the Wise API
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import os
import httpx
import uuid

from config import db, logger

router = APIRouter(prefix="/wise-payouts", tags=["Wise Payouts"])

# Wise API Configuration
WISE_API_TOKEN = os.environ.get("WISE_API_TOKEN", "")
WISE_SANDBOX = os.environ.get("WISE_SANDBOX_MODE", "false").lower() == "true"
WISE_API_URL = "https://api.sandbox.wise.com" if WISE_SANDBOX else "https://api.wise.com"

# Pydantic Models
class WiseBankAccountRequest(BaseModel):
    account_holder_name: str
    iban: str
    currency: str = "EUR"

class WisePayoutRequest(BaseModel):
    amount: Optional[float] = None
    reference: str = "BidBlitz Partner Auszahlung"


async def get_wise_headers():
    """Get headers for Wise API requests"""
    return {
        "Authorization": f"Bearer {WISE_API_TOKEN}",
        "Content-Type": "application/json"
    }


async def get_wise_profile_id():
    """Get the Wise profile ID (business profile)"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{WISE_API_URL}/v1/profiles",
                headers=await get_wise_headers(),
                timeout=30.0
            )
            response.raise_for_status()
            profiles = response.json()
            
            # Prefer business profile, fallback to personal
            for profile in profiles:
                if profile.get("type") == "business":
                    return profile["id"]
            
            # Use first available profile
            if profiles:
                return profiles[0]["id"]
            
            return None
    except Exception as e:
        logger.error(f"Error getting Wise profile: {e}")
        return None


# ==================== WISE BANK ACCOUNT SETUP ====================

@router.post("/setup-bank-account")
async def setup_bank_account(token: str, data: WiseBankAccountRequest):
    """Setup IBAN bank account for payouts - stores locally, attempts Wise registration"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    # Validate IBAN format (basic check)
    iban = data.iban.replace(" ", "").upper()
    if len(iban) < 15 or len(iban) > 34:
        raise HTTPException(status_code=400, detail="Ungültiges IBAN-Format")
    
    wise_recipient_id = None
    wise_connected = False
    
    # Try to register with Wise API (if configured properly)
    try:
        profile_id = await get_wise_profile_id()
        if profile_id:
            recipient_data = {
                "currency": data.currency,
                "type": "iban",
                "profile": profile_id,
                "accountHolderName": data.account_holder_name,
                "legalType": "BUSINESS" if partner.get("business_type") else "PRIVATE",
                "details": {
                    "iban": iban
                }
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{WISE_API_URL}/v1/accounts",
                    headers=await get_wise_headers(),
                    json=recipient_data,
                    timeout=30.0
                )
                
                if response.status_code < 400:
                    recipient = response.json()
                    wise_recipient_id = recipient.get("id")
                    wise_connected = True
                    logger.info(f"Wise recipient created: {wise_recipient_id}")
                else:
                    logger.warning(f"Wise API not available, storing bank details locally")
    except Exception as e:
        logger.warning(f"Wise API error (storing locally): {e}")
    
    # Always store bank details locally for manual processing
    partner_collection = db.partner_accounts
    await partner_collection.update_one(
        {"id": partner["id"]},
        {"$set": {
            "wise_recipient_id": wise_recipient_id,
            "wise_account_holder": data.account_holder_name,
            "wise_iban": iban[-4:],  # Last 4 digits for display
            "wise_iban_full": iban,  # Full IBAN for admin processing
            "wise_currency": data.currency,
            "wise_setup_complete": True,
            "wise_api_connected": wise_connected,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Bank account saved for partner {partner['id']} (Wise API: {wise_connected})")
    
    return {
        "success": True,
        "recipient_id": wise_recipient_id,
        "wise_connected": wise_connected,
        "message": "Bankkonto erfolgreich gespeichert" + (" (Wise verbunden)" if wise_connected else " (manuelle Auszahlung)")
    }


@router.get("/account-status")
async def get_wise_account_status(token: str):
    """Get Wise account status for partner"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    wise_setup = partner.get("wise_setup_complete", False)
    
    return {
        "connected": wise_setup,
        "recipient_id": partner.get("wise_recipient_id"),
        "account_holder": partner.get("wise_account_holder"),
        "iban_last4": partner.get("wise_iban"),
        "currency": partner.get("wise_currency", "EUR"),
        "payouts_enabled": wise_setup,
        "wise_api_connected": partner.get("wise_api_connected", False)
    }


# ==================== WISE PAYOUTS ====================

@router.post("/request-payout")
async def request_wise_payout(token: str, data: WisePayoutRequest):
    """Request a payout via Wise transfer or manual processing"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    # Verify bank account setup
    if not partner.get("wise_setup_complete"):
        raise HTTPException(status_code=400, detail="Bitte verbinden Sie zuerst Ihr Bankkonto")
    
    # Get pending payout amount
    partner_collection = db.partner_accounts
    pending_amount = partner.get("pending_payout", 0)
    
    if data.amount:
        payout_amount = min(data.amount, pending_amount)
    else:
        payout_amount = pending_amount
    
    if payout_amount < 10:  # Minimum €10
        raise HTTPException(status_code=400, detail="Mindestbetrag für Auszahlung: €10")
    
    wise_api_connected = partner.get("wise_api_connected", False)
    wise_recipient_id = partner.get("wise_recipient_id")
    transfer_id = None
    payout_status = "pending_manual"
    
    # Try Wise API if connected and has recipient
    if wise_api_connected and wise_recipient_id:
        try:
            profile_id = await get_wise_profile_id()
            if profile_id:
                # Step 1: Create a quote
                quote_data = {
                    "sourceCurrency": "EUR",
                    "targetCurrency": partner.get("wise_currency", "EUR"),
                    "sourceAmount": payout_amount,
                    "profile": profile_id
                }
                
                async with httpx.AsyncClient() as client:
                    quote_response = await client.post(
                        f"{WISE_API_URL}/v3/profiles/{profile_id}/quotes",
                        headers=await get_wise_headers(),
                        json=quote_data,
                        timeout=30.0
                    )
                    
                    if quote_response.status_code < 400:
                        quote = quote_response.json()
                        quote_id = quote["id"]
                        
                        # Step 2: Create transfer
                        transfer_data = {
                            "targetAccount": wise_recipient_id,
                            "quoteUuid": quote_id,
                            "customerTransactionId": str(uuid.uuid4()),
                            "details": {
                                "reference": data.reference or f"BidBlitz Auszahlung {partner.get('business_name', '')}"
                            }
                        }
                        
                        transfer_response = await client.post(
                            f"{WISE_API_URL}/v1/transfers",
                            headers=await get_wise_headers(),
                            json=transfer_data,
                            timeout=30.0
                        )
                        
                        if transfer_response.status_code < 400:
                            transfer = transfer_response.json()
                            transfer_id = transfer["id"]
                            payout_status = "processing"
                            
                            # Try to fund from Wise balance
                            fund_response = await client.post(
                                f"{WISE_API_URL}/v3/profiles/{profile_id}/transfers/{transfer_id}/payments",
                                headers=await get_wise_headers(),
                                json={"type": "BALANCE"},
                                timeout=30.0
                            )
                            if fund_response.status_code < 400:
                                payout_status = "funded"
        except Exception as e:
            logger.warning(f"Wise API transfer failed, creating manual payout request: {e}")
    
    # Record payout in database (works for both Wise and manual)
    payout_record = {
        "id": f"payout_{str(uuid.uuid4())[:8]}",
        "partner_id": partner["id"],
        "wise_transfer_id": transfer_id,
        "amount": payout_amount,
        "currency": partner.get("wise_currency", "EUR"),
        "status": payout_status,
        "reference": data.reference or f"BidBlitz Auszahlung",
        "iban": partner.get("wise_iban_full", ""),
        "account_holder": partner.get("wise_account_holder", ""),
        "requested_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.partner_payouts.insert_one(payout_record)
    
    # Update partner's pending payout
    new_pending = max(0, pending_amount - payout_amount)
    await partner_collection.update_one(
        {"id": partner["id"]},
        {"$set": {
            "pending_payout": new_pending,
            "last_payout_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Payout request created for partner {partner['id']}: €{payout_amount} (status: {payout_status})")
    
    if payout_status == "pending_manual":
        return {
            "success": True,
            "payout_id": payout_record["id"],
            "amount": payout_amount,
            "status": payout_status,
            "message": f"Auszahlung von €{payout_amount:.2f} angefordert. Wird manuell bearbeitet (1-3 Werktage)."
        }
    else:
        return {
            "success": True,
            "transfer_id": transfer_id,
            "amount": payout_amount,
            "status": payout_status,
            "message": f"Auszahlung von €{payout_amount:.2f} wird automatisch verarbeitet"
        }
            
            transfer = transfer_response.json()
            transfer_id = transfer["id"]
            
            # Step 3: Fund the transfer (from Wise balance)
            fund_response = await client.post(
                f"{WISE_API_URL}/v3/profiles/{profile_id}/transfers/{transfer_id}/payments",
                headers=await get_wise_headers(),
                json={"type": "BALANCE"},
                timeout=30.0
            )
            
            if fund_response.status_code >= 400:
                error = fund_response.json() if fund_response.content else {}
                logger.error(f"Wise funding error: {error}")
                # Transfer created but not funded - still log it
                fund_status = "pending_funding"
            else:
                fund_status = "processing"
        
        # Record payout in database
        payout_record = {
            "id": f"wise_{transfer_id}",
            "partner_id": partner["id"],
            "wise_transfer_id": transfer_id,
            "wise_quote_id": quote_id,
            "amount": payout_amount,
            "currency": partner.get("wise_currency", "EUR"),
            "status": fund_status,
            "reference": data.reference,
            "requested_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.partner_payouts.insert_one(payout_record)
        
        # Update partner's pending payout
        new_pending = max(0, pending_amount - payout_amount)
        await partner_collection.update_one(
            {"id": partner["id"]},
            {"$set": {
                "pending_payout": new_pending,
                "last_payout_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Wise payout {transfer_id} created for partner {partner['id']}: €{payout_amount}")
        
        return {
            "success": True,
            "transfer_id": transfer_id,
            "amount": payout_amount,
            "status": fund_status,
            "message": f"Auszahlung von €{payout_amount:.2f} wird verarbeitet"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing Wise payout: {e}")
        raise HTTPException(status_code=500, detail=f"Fehler bei der Auszahlung: {str(e)}")


@router.get("/payout-history")
async def get_wise_payout_history(token: str):
    """Get payout history for partner"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    payouts = await db.partner_payouts.find(
        {"partner_id": partner["id"]}
    ).sort("requested_at", -1).limit(50).to_list(50)
    
    # Convert ObjectId to string
    for p in payouts:
        if "_id" in p:
            del p["_id"]
    
    return {"payouts": payouts}


@router.get("/check-transfer/{transfer_id}")
async def check_transfer_status(token: str, transfer_id: int):
    """Check status of a Wise transfer"""
    from routers.partner_portal import get_current_partner
    await get_current_partner(token)  # Verify token
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{WISE_API_URL}/v1/transfers/{transfer_id}",
                headers=await get_wise_headers(),
                timeout=30.0
            )
            
            if response.status_code >= 400:
                raise HTTPException(status_code=404, detail="Transfer nicht gefunden")
            
            transfer = response.json()
            
            # Update local record
            await db.partner_payouts.update_one(
                {"wise_transfer_id": transfer_id},
                {"$set": {
                    "status": transfer.get("status", "unknown").lower(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            return {
                "transfer_id": transfer_id,
                "status": transfer.get("status"),
                "created": transfer.get("created"),
                "rate": transfer.get("rate"),
                "source_amount": transfer.get("sourceValue"),
                "target_amount": transfer.get("targetValue")
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking transfer status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/disconnect")
async def disconnect_wise_account(token: str):
    """Disconnect Wise bank account from partner profile"""
    from routers.partner_portal import get_current_partner
    partner = await get_current_partner(token)
    
    partner_collection = db.partner_accounts
    await partner_collection.update_one(
        {"id": partner["id"]},
        {"$set": {
            "wise_recipient_id": None,
            "wise_account_holder": None,
            "wise_iban": None,
            "wise_currency": None,
            "wise_setup_complete": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Bankkonto getrennt"}

wise_payouts_router = router
