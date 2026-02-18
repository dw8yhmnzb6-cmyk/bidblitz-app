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


# ==================== ADMIN ENDPOINTS ====================

from dependencies import get_admin_user
from fastapi import Depends


@router.get("/pending")
async def get_pending_payouts(admin: dict = Depends(get_admin_user)):
    """Admin: Get all partners with pending payouts"""
    
    # Get all partners with pending payouts
    partners_with_payouts = await db.partner_accounts.find(
        {"pending_payout": {"$gt": 0}},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    ).to_list(100)
    
    # Also check restaurant accounts
    restaurants_with_payouts = await db.restaurant_accounts.find(
        {"pending_payout": {"$gt": 0}},
        {"_id": 0, "password_hash": 0, "auth_token": 0}
    ).to_list(100)
    
    all_partners = partners_with_payouts + restaurants_with_payouts
    
    # Format response
    result = []
    for p in all_partners:
        result.append({
            "partner_id": p.get("id"),
            "partner_name": p.get("business_name") or p.get("company_name") or p.get("name"),
            "earnings_balance": p.get("pending_payout", 0),
            "total_earnings": p.get("total_earned", 0),
            "min_payout_amount": 10,
            "has_bank_details": bool(p.get("wise_setup_complete")),
            "bank_iban": p.get("wise_iban"),
            "bank_holder_name": p.get("wise_account_holder"),
            "wise_connected": p.get("wise_api_connected", False)
        })
    
    # Sort by earnings balance
    result.sort(key=lambda x: x["earnings_balance"], reverse=True)
    
    return {
        "partners": result,
        "total_pending": sum(p["earnings_balance"] for p in result),
        "count": len(result)
    }


@router.get("/history")
async def get_admin_payout_history(limit: int = 50, admin: dict = Depends(get_admin_user)):
    """Admin: Get all payout history"""
    
    payouts = await db.partner_payouts.find(
        {},
        {"_id": 0}
    ).sort("requested_at", -1).limit(limit).to_list(limit)
    
    # Enrich with partner names
    for p in payouts:
        partner = await db.partner_accounts.find_one(
            {"id": p.get("partner_id")},
            {"_id": 0, "business_name": 1, "company_name": 1}
        )
        if not partner:
            partner = await db.restaurant_accounts.find_one(
                {"id": p.get("partner_id")},
                {"_id": 0, "business_name": 1, "company_name": 1}
            )
        p["partner_name"] = partner.get("business_name") or partner.get("company_name") if partner else "Unbekannt"
        p["created_at"] = p.get("requested_at")
    
    return {"payouts": payouts, "count": len(payouts)}


class AdminPayoutRequest(BaseModel):
    partner_id: str
    amount: float


@router.post("/admin/initiate")
async def admin_initiate_payout(data: AdminPayoutRequest, admin: dict = Depends(get_admin_user)):
    """Admin: Initiate a payout for a specific partner"""
    
    partner_id = data.partner_id
    amount = data.amount
    
    # Get partner
    partner = await db.partner_accounts.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        partner = await db.restaurant_accounts.find_one({"id": partner_id}, {"_id": 0})
    
    if not partner:
        raise HTTPException(status_code=404, detail="Partner nicht gefunden")
    
    # Verify bank details
    if not partner.get("wise_setup_complete"):
        raise HTTPException(status_code=400, detail="Partner hat keine Bankdaten hinterlegt")
    
    # Verify amount
    pending = partner.get("pending_payout", 0)
    if amount > pending:
        raise HTTPException(status_code=400, detail=f"Betrag überschreitet verfügbares Guthaben (€{pending:.2f})")
    
    # Create payout record
    payout_id = f"payout_admin_{str(uuid.uuid4())[:8]}"
    payout_status = "pending_manual"  # Default to manual processing
    
    # Try Wise API if configured
    wise_transfer_id = None
    if partner.get("wise_api_connected") and partner.get("wise_recipient_id"):
        try:
            profile_id = await get_wise_profile_id()
            if profile_id:
                # Create quote
                async with httpx.AsyncClient() as client:
                    quote_response = await client.post(
                        f"{WISE_API_URL}/v3/profiles/{profile_id}/quotes",
                        headers=await get_wise_headers(),
                        json={
                            "sourceCurrency": "EUR",
                            "targetCurrency": partner.get("wise_currency", "EUR"),
                            "sourceAmount": amount,
                            "profile": profile_id
                        },
                        timeout=30.0
                    )
                    
                    if quote_response.status_code < 400:
                        quote = quote_response.json()
                        
                        # Create transfer
                        transfer_response = await client.post(
                            f"{WISE_API_URL}/v1/transfers",
                            headers=await get_wise_headers(),
                            json={
                                "targetAccount": partner["wise_recipient_id"],
                                "quoteUuid": quote["id"],
                                "customerTransactionId": str(uuid.uuid4()),
                                "details": {"reference": f"BidBlitz Admin Payout {payout_id}"}
                            },
                            timeout=30.0
                        )
                        
                        if transfer_response.status_code < 400:
                            transfer = transfer_response.json()
                            wise_transfer_id = transfer["id"]
                            payout_status = "processing"
                            
                            # Fund transfer
                            await client.post(
                                f"{WISE_API_URL}/v3/profiles/{profile_id}/transfers/{wise_transfer_id}/payments",
                                headers=await get_wise_headers(),
                                json={"type": "BALANCE"},
                                timeout=30.0
                            )
                            payout_status = "funded"
        except Exception as e:
            logger.warning(f"Wise API error, falling back to manual: {e}")
    
    # Record payout
    payout_record = {
        "id": payout_id,
        "partner_id": partner_id,
        "wise_transfer_id": wise_transfer_id,
        "amount": amount,
        "currency": partner.get("wise_currency", "EUR"),
        "status": payout_status,
        "reference": f"BidBlitz Admin Payout",
        "iban": partner.get("wise_iban_full", ""),
        "account_holder": partner.get("wise_account_holder", ""),
        "initiated_by": admin.get("email"),
        "requested_at": datetime.now(timezone.utc).isoformat()
    }
    await db.partner_payouts.insert_one(payout_record)
    
    # Update partner balance
    collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner_id}) else db.restaurant_accounts
    await collection.update_one(
        {"id": partner_id},
        {
            "$inc": {"pending_payout": -amount},
            "$set": {"last_payout_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    logger.info(f"Admin payout initiated: €{amount} to {partner_id} by {admin.get('email')}")
    
    return {
        "success": True,
        "payout_id": payout_id,
        "amount": amount,
        "status": payout_status,
        "message": f"Auszahlung von €{amount:.2f} initiiert" + (" (automatisch via Wise)" if wise_transfer_id else " (manuelle Bearbeitung)")
    }


class BatchPayoutRequest(BaseModel):
    partner_ids: list


@router.post("/admin/batch")
async def admin_batch_payout(data: BatchPayoutRequest, admin: dict = Depends(get_admin_user)):
    """Admin: Process batch payouts for multiple partners"""
    
    partner_ids = data.partner_ids
    results = []
    total_amount = 0
    
    for partner_id in partner_ids:
        try:
            # Get partner
            partner = await db.partner_accounts.find_one({"id": partner_id}, {"_id": 0})
            if not partner:
                partner = await db.restaurant_accounts.find_one({"id": partner_id}, {"_id": 0})
            
            if not partner:
                results.append({"partner_id": partner_id, "error": "Partner nicht gefunden"})
                continue
            
            if not partner.get("wise_setup_complete"):
                results.append({"partner_id": partner_id, "error": "Keine Bankdaten"})
                continue
            
            amount = partner.get("pending_payout", 0)
            if amount < 10:
                results.append({"partner_id": partner_id, "error": f"Betrag zu niedrig (€{amount:.2f})"})
                continue
            
            # Create simple payout record (manual processing)
            payout_id = f"payout_batch_{str(uuid.uuid4())[:8]}"
            payout_record = {
                "id": payout_id,
                "partner_id": partner_id,
                "amount": amount,
                "currency": "EUR",
                "status": "pending_manual",
                "reference": f"BidBlitz Batch Payout",
                "iban": partner.get("wise_iban_full", ""),
                "account_holder": partner.get("wise_account_holder", ""),
                "initiated_by": admin.get("email"),
                "batch": True,
                "requested_at": datetime.now(timezone.utc).isoformat()
            }
            await db.partner_payouts.insert_one(payout_record)
            
            # Update partner balance
            collection = db.partner_accounts if await db.partner_accounts.find_one({"id": partner_id}) else db.restaurant_accounts
            await collection.update_one(
                {"id": partner_id},
                {
                    "$inc": {"pending_payout": -amount},
                    "$set": {"last_payout_at": datetime.now(timezone.utc).isoformat()}
                }
            )
            
            total_amount += amount
            results.append({
                "partner_id": partner_id,
                "success": True,
                "payout_id": payout_id,
                "amount": amount
            })
            
        except Exception as e:
            results.append({"partner_id": partner_id, "error": str(e)})
    
    successful = sum(1 for r in results if r.get("success"))
    
    logger.info(f"Batch payout: {successful}/{len(partner_ids)} processed, total €{total_amount:.2f} by {admin.get('email')}")
    
    return {
        "success": True,
        "message": f"{successful}/{len(partner_ids)} Auszahlungen verarbeitet",
        "total_amount": total_amount,
        "results": results
    }


wise_payouts_router = router
