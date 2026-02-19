"""
Universal Transfer System
Supports all transfer directions:
- Partner → Customer (credit balance)
- Customer → Partner (payment - handled by BidBlitz Pay)
- Customer → Customer (P2P transfer)
- Partner → Partner (inter-merchant transfer)
- Partner Customer Top-Up (Partner tops up customer balance using their admin credit)
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, Literal
import uuid
from config import db
from utils.auth import get_current_user

router = APIRouter(prefix="/universal-transfer", tags=["Universal Transfer"])


# ==================== MODELS ====================

class UniversalTransferRequest(BaseModel):
    recipient_id: str = Field(..., description="Customer ID (BID-XXXXX), Partner number (P-XXXXX), or email")
    amount: float = Field(..., gt=0, le=10000, description="Amount to transfer")
    message: Optional[str] = Field(None, max_length=200, description="Optional message")
    use_admin_credit: bool = Field(False, description="Use partner's admin credit for customer top-up")


class TransferResponse(BaseModel):
    success: bool
    message: str
    transfer_id: str
    amount: float
    recipient_name: str
    recipient_type: str  # 'customer' or 'partner'
    new_balance: float
    admin_credit_used: Optional[float] = None


class AdminCreditRequest(BaseModel):
    partner_id: str = Field(..., description="Partner ID")
    amount: float = Field(..., description="Credit amount (positive to add, negative to deduct)")
    reason: str = Field(..., description="Reason for credit adjustment")


# ==================== HELPER FUNCTIONS ====================

async def get_partner_by_token(token: str):
    """Get partner by auth token"""
    partner = await db.partner_accounts.find_one({"auth_token": token}, {"_id": 0})
    if not partner:
        partner = await db.restaurant_accounts.find_one({"auth_token": token}, {"_id": 0})
    return partner


async def get_user_by_identifier(identifier: str):
    """Get user by customer number, email, or partner number"""
    identifier = identifier.strip()
    
    # Check if it's a customer ID (BID-XXXXXX)
    if identifier.upper().startswith("BID-"):
        user = await db.users.find_one(
            {"customer_number": identifier.upper()},
            {"_id": 0, "id": 1, "email": 1, "name": 1, "customer_number": 1}
        )
        if user:
            return {"type": "customer", "data": user}
    
    # Check if it's a partner number (P-XXXXX)
    if identifier.upper().startswith("P-"):
        partner = await db.partner_accounts.find_one(
            {"partner_number": identifier.upper(), "status": "approved"},
            {"_id": 0}
        )
        if partner:
            return {"type": "partner", "data": partner}
        partner = await db.restaurant_accounts.find_one(
            {"partner_number": identifier.upper(), "status": "approved"},
            {"_id": 0}
        )
        if partner:
            return {"type": "partner", "data": partner}
    
    # Try email lookup for customers
    user = await db.users.find_one(
        {"email": identifier.lower()},
        {"_id": 0, "id": 1, "email": 1, "name": 1, "customer_number": 1}
    )
    if user:
        return {"type": "customer", "data": user}
    
    # Try email lookup for partners
    partner = await db.partner_accounts.find_one(
        {"email": identifier.lower(), "status": "approved"},
        {"_id": 0}
    )
    if partner:
        return {"type": "partner", "data": partner}
    
    partner = await db.restaurant_accounts.find_one(
        {"email": identifier.lower(), "status": "approved"},
        {"_id": 0}
    )
    if partner:
        return {"type": "partner", "data": partner}
    
    return None


# ==================== PARTNER ENDPOINTS ====================

@router.post("/partner/send")
async def partner_send_money(
    data: UniversalTransferRequest,
    token: str = Query(...)
):
    """
    Partner sends money to anyone (customer or partner)
    - To customer: Credits their wallet balance
    - To partner: Transfers from partner balance
    - With admin credit: Uses partner's admin credit line for customer top-ups
    """
    # Authenticate partner
    sender = await get_partner_by_token(token)
    if not sender:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    # Find recipient
    recipient = await get_user_by_identifier(data.recipient_id)
    if not recipient:
        raise HTTPException(
            status_code=404,
            detail="Empfänger nicht gefunden. Verwenden Sie eine Kundennummer (BID-XXXXXX), Partnernummer (P-XXXXX) oder E-Mail-Adresse."
        )
    
    sender_balance = sender.get("pending_payout", 0)
    admin_credit = sender.get("admin_credit", 0)
    admin_credit_used = 0
    
    # Check balance
    if data.use_admin_credit and recipient["type"] == "customer":
        # Use admin credit for customer top-ups
        if admin_credit < data.amount:
            raise HTTPException(
                status_code=400,
                detail=f"Nicht genug Admin-Guthaben. Verfügbar: €{admin_credit:.2f}"
            )
        admin_credit_used = data.amount
    else:
        # Use regular balance
        if sender_balance < data.amount:
            raise HTTPException(
                status_code=400,
                detail=f"Nicht genug Guthaben. Verfügbar: €{sender_balance:.2f}"
            )
    
    # Create transfer record
    transfer_id = f"TRF-{str(uuid.uuid4())[:8].upper()}"
    transfer = {
        "id": transfer_id,
        "type": "partner_to_customer" if recipient["type"] == "customer" else "partner_to_partner",
        "sender_type": "partner",
        "sender_id": sender.get("id"),
        "sender_name": sender.get("business_name", sender.get("company_name", "")),
        "sender_number": sender.get("partner_number", ""),
        "recipient_type": recipient["type"],
        "recipient_id": recipient["data"].get("id"),
        "recipient_name": recipient["data"].get("name") if recipient["type"] == "customer" else recipient["data"].get("business_name", recipient["data"].get("company_name", "")),
        "recipient_number": recipient["data"].get("customer_number") if recipient["type"] == "customer" else recipient["data"].get("partner_number", ""),
        "amount": data.amount,
        "message": data.message,
        "admin_credit_used": admin_credit_used > 0,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.universal_transfers.insert_one(transfer)
    
    # Update balances
    if admin_credit_used > 0:
        # Deduct from admin credit
        await db.partner_accounts.update_one(
            {"id": sender.get("id")},
            {
                "$inc": {"admin_credit": -data.amount, "admin_credit_used": data.amount},
                "$push": {
                    "admin_credit_history": {
                        "amount": -data.amount,
                        "reason": f"Kunden-Aufladung: {recipient['data'].get('customer_number', '')}",
                        "transfer_id": transfer_id,
                        "date": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
    else:
        # Deduct from regular balance
        collection = db.partner_accounts if await db.partner_accounts.find_one({"id": sender.get("id")}) else db.restaurant_accounts
        await collection.update_one(
            {"id": sender.get("id")},
            {"$inc": {"pending_payout": -data.amount}}
        )
    
    # Credit recipient
    if recipient["type"] == "customer":
        # Credit customer's main balance
        await db.users.update_one(
            {"id": recipient["data"].get("id")},
            {"$inc": {"balance": data.amount}}
        )
        
        # Create wallet transaction for customer
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": recipient["data"].get("id"),
            "type": "credit",
            "amount": data.amount,
            "description": f"Gutschrift von {sender.get('business_name', sender.get('company_name', ''))}",
            "source": "partner_credit",
            "source_id": transfer_id,
            "message": data.message,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    else:
        # Credit partner's balance
        recipient_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": recipient["data"].get("id")}) else db.restaurant_accounts
        await recipient_collection.update_one(
            {"id": recipient["data"].get("id")},
            {"$inc": {"pending_payout": data.amount, "total_earned": data.amount}}
        )
    
    # Get updated sender balance
    updated_sender = await db.partner_accounts.find_one({"id": sender.get("id")}, {"_id": 0})
    if not updated_sender:
        updated_sender = await db.restaurant_accounts.find_one({"id": sender.get("id")}, {"_id": 0})
    
    return TransferResponse(
        success=True,
        message=f"€{data.amount:.2f} erfolgreich an {transfer['recipient_name']} gesendet",
        transfer_id=transfer_id,
        amount=data.amount,
        recipient_name=transfer["recipient_name"],
        recipient_type=recipient["type"],
        new_balance=updated_sender.get("pending_payout", 0) if not admin_credit_used else updated_sender.get("admin_credit", 0),
        admin_credit_used=admin_credit_used if admin_credit_used > 0 else None
    )


@router.get("/partner/balance")
async def get_partner_balances(token: str = Query(...)):
    """Get partner's available balances (regular and admin credit)"""
    partner = await get_partner_by_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    return {
        "available_balance": partner.get("pending_payout", 0),
        "admin_credit": partner.get("admin_credit", 0),
        "admin_credit_used": partner.get("admin_credit_used", 0),
        "total_earned": partner.get("total_earned", 0),
        "partner_number": partner.get("partner_number", ""),
        "business_name": partner.get("business_name", partner.get("company_name", ""))
    }


@router.get("/partner/history")
async def get_partner_transfer_history(
    token: str = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Get partner's universal transfer history"""
    partner = await get_partner_by_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    query = {
        "$or": [
            {"sender_id": partner_id},
            {"recipient_id": partner_id}
        ]
    }
    
    total = await db.universal_transfers.count_documents(query)
    
    transfers = await db.universal_transfers.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    for transfer in transfers:
        transfer["direction"] = "sent" if transfer.get("sender_id") == partner_id else "received"
    
    return {
        "transfers": transfers,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


# ==================== CUSTOMER ENDPOINTS ====================

@router.post("/customer/send")
async def customer_send_money(
    data: UniversalTransferRequest,
    user: dict = Depends(get_current_user)
):
    """
    Customer sends money to anyone (customer or partner)
    """
    user_id = user.get("id")
    
    # Get customer data
    customer = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Find recipient
    recipient = await get_user_by_identifier(data.recipient_id)
    if not recipient:
        raise HTTPException(
            status_code=404,
            detail="Empfänger nicht gefunden. Verwenden Sie eine Kundennummer (BID-XXXXXX), Partnernummer (P-XXXXX) oder E-Mail-Adresse."
        )
    
    # Cannot send to self
    if recipient["type"] == "customer" and recipient["data"].get("id") == user_id:
        raise HTTPException(status_code=400, detail="Sie können nicht an sich selbst senden")
    
    # Check balance
    sender_balance = customer.get("balance", 0)
    if sender_balance < data.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Nicht genug Guthaben. Verfügbar: €{sender_balance:.2f}"
        )
    
    # Create transfer record
    transfer_id = f"TRF-{str(uuid.uuid4())[:8].upper()}"
    transfer = {
        "id": transfer_id,
        "type": "customer_to_customer" if recipient["type"] == "customer" else "customer_to_partner",
        "sender_type": "customer",
        "sender_id": user_id,
        "sender_name": customer.get("name", ""),
        "sender_number": customer.get("customer_number", ""),
        "recipient_type": recipient["type"],
        "recipient_id": recipient["data"].get("id"),
        "recipient_name": recipient["data"].get("name") if recipient["type"] == "customer" else recipient["data"].get("business_name", recipient["data"].get("company_name", "")),
        "recipient_number": recipient["data"].get("customer_number") if recipient["type"] == "customer" else recipient["data"].get("partner_number", ""),
        "amount": data.amount,
        "message": data.message,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.universal_transfers.insert_one(transfer)
    
    # Deduct from sender
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"balance": -data.amount}}
    )
    
    # Credit recipient
    if recipient["type"] == "customer":
        await db.users.update_one(
            {"id": recipient["data"].get("id")},
            {"$inc": {"balance": data.amount}}
        )
        
        # Create wallet transaction for recipient
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": recipient["data"].get("id"),
            "type": "credit",
            "amount": data.amount,
            "description": f"Überweisung von {customer.get('name', 'Kunde')}",
            "source": "p2p_transfer",
            "source_id": transfer_id,
            "message": data.message,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    else:
        # Credit partner's balance
        recipient_collection = db.partner_accounts if await db.partner_accounts.find_one({"id": recipient["data"].get("id")}) else db.restaurant_accounts
        await recipient_collection.update_one(
            {"id": recipient["data"].get("id")},
            {"$inc": {"pending_payout": data.amount, "total_earned": data.amount}}
        )
    
    # Create wallet transaction for sender
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "debit",
        "amount": data.amount,
        "description": f"Überweisung an {transfer['recipient_name']}",
        "source": "p2p_transfer" if recipient["type"] == "customer" else "partner_payment",
        "source_id": transfer_id,
        "message": data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Get updated balance
    updated_customer = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    return TransferResponse(
        success=True,
        message=f"€{data.amount:.2f} erfolgreich an {transfer['recipient_name']} gesendet",
        transfer_id=transfer_id,
        amount=data.amount,
        recipient_name=transfer["recipient_name"],
        recipient_type=recipient["type"],
        new_balance=updated_customer.get("balance", 0)
    )


@router.get("/customer/history")
async def get_customer_transfer_history(
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Get customer's universal transfer history"""
    user_id = user.get("id")
    
    query = {
        "$or": [
            {"sender_id": user_id},
            {"recipient_id": user_id}
        ]
    }
    
    total = await db.universal_transfers.count_documents(query)
    
    transfers = await db.universal_transfers.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    for transfer in transfers:
        transfer["direction"] = "sent" if transfer.get("sender_id") == user_id else "received"
    
    return {
        "transfers": transfers,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


# ==================== SEARCH ENDPOINTS ====================

@router.get("/search")
async def search_recipient(
    query: str = Query(..., min_length=2),
    token: str = Query(None),
    user: dict = Depends(get_current_user)
):
    """
    Search for recipients (customers and partners)
    Works for both partners (with token) and customers (with auth)
    """
    results = []
    
    # Search customers
    customers = await db.users.find(
        {
            "$or": [
                {"customer_number": {"$regex": query.upper(), "$options": "i"}},
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query.lower(), "$options": "i"}}
            ]
        },
        {"_id": 0, "id": 1, "name": 1, "customer_number": 1, "email": 1}
    ).limit(5).to_list(5)
    
    for c in customers:
        results.append({
            "type": "customer",
            "id": c.get("customer_number", ""),
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "display": f"{c.get('name', '')} ({c.get('customer_number', '')})"
        })
    
    # Search partners
    partners = await db.partner_accounts.find(
        {
            "$or": [
                {"partner_number": {"$regex": query.upper(), "$options": "i"}},
                {"business_name": {"$regex": query, "$options": "i"}},
                {"company_name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query.lower(), "$options": "i"}}
            ],
            "status": "approved"
        },
        {"_id": 0, "id": 1, "business_name": 1, "company_name": 1, "partner_number": 1, "email": 1}
    ).limit(5).to_list(5)
    
    for p in partners:
        name = p.get("business_name", p.get("company_name", ""))
        results.append({
            "type": "partner",
            "id": p.get("partner_number", ""),
            "name": name,
            "email": p.get("email", ""),
            "display": f"{name} ({p.get('partner_number', '')})"
        })
    
    return {"results": results}


# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/credit")
async def admin_manage_partner_credit(
    data: AdminCreditRequest,
    user: dict = Depends(get_current_user)
):
    """
    Admin adds or removes credit from a partner's admin credit line
    This credit can be used by partners to top up customer balances
    """
    # Check if user is admin
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins können Guthaben verwalten")
    
    # Find partner
    partner = await db.partner_accounts.find_one({"id": data.partner_id}, {"_id": 0})
    if not partner:
        partner = await db.restaurant_accounts.find_one({"id": data.partner_id}, {"_id": 0})
    
    if not partner:
        raise HTTPException(status_code=404, detail="Partner nicht gefunden")
    
    # Update credit
    current_credit = partner.get("admin_credit", 0)
    new_credit = current_credit + data.amount
    
    if new_credit < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Nicht genug Guthaben zum Abziehen. Aktuell: €{current_credit:.2f}"
        )
    
    collection = db.partner_accounts if await db.partner_accounts.find_one({"id": data.partner_id}) else db.restaurant_accounts
    
    await collection.update_one(
        {"id": data.partner_id},
        {
            "$set": {"admin_credit": new_credit},
            "$push": {
                "admin_credit_history": {
                    "amount": data.amount,
                    "reason": data.reason,
                    "admin_id": user.get("id"),
                    "admin_name": user.get("name", "Admin"),
                    "date": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    # Create admin log
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": user.get("id"),
        "action": "partner_credit_adjustment",
        "details": {
            "partner_id": data.partner_id,
            "partner_name": partner.get("business_name", partner.get("company_name", "")),
            "amount": data.amount,
            "reason": data.reason,
            "new_balance": new_credit
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": f"€{abs(data.amount):.2f} {'hinzugefügt' if data.amount > 0 else 'abgezogen'}",
        "partner_name": partner.get("business_name", partner.get("company_name", "")),
        "previous_credit": current_credit,
        "new_credit": new_credit
    }


@router.get("/admin/partner-credits")
async def admin_get_all_partner_credits(
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get all partners with their admin credit balances"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    
    partners = await db.partner_accounts.find(
        {"status": "approved"},
        {
            "_id": 0,
            "id": 1,
            "business_name": 1,
            "company_name": 1,
            "partner_number": 1,
            "admin_credit": 1,
            "admin_credit_used": 1,
            "admin_credit_history": {"$slice": -5}
        }
    ).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    total = await db.partner_accounts.count_documents({"status": "approved"})
    
    return {
        "partners": partners,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }
