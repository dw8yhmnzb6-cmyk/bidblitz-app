"""
Partner-to-Partner Transfer System
Allows partners/merchants to send money to other partners
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid

router = APIRouter(prefix="/partner-transfer", tags=["Partner Transfer"])


def get_db():
    """Get database connection"""
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
    return client[os.environ.get("DB_NAME", "bidblitz")]


class TransferRequest(BaseModel):
    recipient_identifier: str = Field(..., description="Partner number or email of recipient")
    amount: float = Field(..., gt=0, description="Amount to transfer")
    message: str = Field(None, max_length=200, description="Optional message")


class TransferResponse(BaseModel):
    success: bool
    message: str
    transfer_id: str = None
    new_balance: float = None
    recipient_name: str = None


async def get_partner_by_token(token: str):
    """Get partner by auth token"""
    db = get_db()
    partner = await db.partner_accounts.find_one({"auth_token": token}, {"_id": 0})
    if not partner:
        partner = await db.restaurant_accounts.find_one({"auth_token": token}, {"_id": 0})
    return partner


async def get_partner_collection(partner_id: str):
    """Get the correct collection for a partner"""
    db = get_db()
    if await db.partner_accounts.find_one({"id": partner_id}):
        return db.partner_accounts
    return db.restaurant_accounts


@router.get("/balance")
async def get_transfer_balance(token: str = Query(...)):
    """Get partner's available balance for transfers"""
    import logging
    logging.info(f"[DEBUG] Balance request with token: {token[:20]}...")
    
    partner = await get_partner_by_token(token)
    
    logging.info(f"[DEBUG] Partner found: {partner.get('email') if partner else 'None'}")
    
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    return {
        "available_balance": partner.get("pending_payout", 0),
        "total_earned": partner.get("total_earned", 0),
        "partner_number": partner.get("partner_number", ""),
        "business_name": partner.get("business_name", partner.get("company_name", ""))
    }


@router.post("/send", response_model=TransferResponse)
async def send_to_partner(data: TransferRequest, token: str = Query(...)):
    """Send money to another partner"""
    db = get_db()
    
    # Get sender
    sender = await get_partner_by_token(token)
    if not sender:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    # Check sender's balance
    sender_balance = sender.get("pending_payout", 0)
    if sender_balance < data.amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Verfügbar: €{sender_balance:.2f}"
        )
    
    # Find recipient by partner number or email
    recipient = await db.partner_accounts.find_one({
        "$or": [
            {"partner_number": data.recipient_identifier.upper()},
            {"email": data.recipient_identifier.lower()}
        ],
        "status": "approved"
    }, {"_id": 0})
    
    if not recipient:
        recipient = await db.restaurant_accounts.find_one({
            "$or": [
                {"partner_number": data.recipient_identifier.upper()},
                {"email": data.recipient_identifier.lower()}
            ],
            "status": "approved"
        }, {"_id": 0})
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    # Cannot send to self
    if recipient.get("id") == sender.get("id"):
        raise HTTPException(status_code=400, detail="Sie können nicht an sich selbst überweisen")
    
    # Create transfer record
    transfer_id = str(uuid.uuid4())[:8].upper()
    transfer = {
        "id": transfer_id,
        "sender_id": sender.get("id"),
        "sender_name": sender.get("business_name", sender.get("company_name", "")),
        "sender_number": sender.get("partner_number", ""),
        "recipient_id": recipient.get("id"),
        "recipient_name": recipient.get("business_name", recipient.get("company_name", "")),
        "recipient_number": recipient.get("partner_number", ""),
        "amount": data.amount,
        "message": data.message,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.partner_transfers.insert_one(transfer)
    
    # Update sender's balance
    sender_collection = await get_partner_collection(sender.get("id"))
    await sender_collection.update_one(
        {"id": sender.get("id")},
        {"$inc": {"pending_payout": -data.amount}}
    )
    
    # Update recipient's balance
    recipient_collection = await get_partner_collection(recipient.get("id"))
    await recipient_collection.update_one(
        {"id": recipient.get("id")},
        {"$inc": {"pending_payout": data.amount, "total_earned": data.amount}}
    )
    
    # Get updated balance
    updated_sender = await sender_collection.find_one({"id": sender.get("id")}, {"_id": 0})
    
    return TransferResponse(
        success=True,
        message=f"€{data.amount:.2f} erfolgreich an {recipient.get('business_name', recipient.get('company_name', ''))} gesendet",
        transfer_id=transfer_id,
        new_balance=updated_sender.get("pending_payout", 0),
        recipient_name=recipient.get("business_name", recipient.get("company_name", ""))
    )


@router.get("/history")
async def get_transfer_history(
    token: str = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Get partner's transfer history"""
    db = get_db()
    
    partner = await get_partner_by_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    # Get transfers where partner is sender or recipient
    query = {
        "$or": [
            {"sender_id": partner_id},
            {"recipient_id": partner_id}
        ]
    }
    
    total = await db.partner_transfers.count_documents(query)
    
    transfers = await db.partner_transfers.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    # Mark direction for each transfer
    for transfer in transfers:
        transfer["direction"] = "sent" if transfer.get("sender_id") == partner_id else "received"
    
    return {
        "transfers": transfers,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/search-partner")
async def search_partner(
    query: str = Query(..., min_length=2),
    token: str = Query(...)
):
    """Search for a partner by name, email or partner number"""
    db = get_db()
    
    partner = await get_partner_by_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    search_filter = {
        "$or": [
            {"business_name": {"$regex": query, "$options": "i"}},
            {"company_name": {"$regex": query, "$options": "i"}},
            {"email": {"$regex": query, "$options": "i"}},
            {"partner_number": {"$regex": query.upper(), "$options": "i"}}
        ],
        "status": "approved",
        "id": {"$ne": partner.get("id")}  # Exclude self
    }
    
    partners = await db.partner_accounts.find(
        search_filter,
        {"_id": 0, "id": 1, "business_name": 1, "company_name": 1, "partner_number": 1, "email": 1}
    ).limit(10).to_list(10)
    
    # Also search restaurant accounts
    restaurants = await db.restaurant_accounts.find(
        search_filter,
        {"_id": 0, "id": 1, "business_name": 1, "company_name": 1, "partner_number": 1, "email": 1}
    ).limit(10).to_list(10)
    
    results = partners + restaurants
    
    # Format results
    formatted = []
    for p in results[:10]:
        formatted.append({
            "partner_number": p.get("partner_number", ""),
            "name": p.get("business_name", p.get("company_name", "")),
            "email": p.get("email", "")
        })
    
    return {"results": formatted}


@router.get("/last-recipient")
async def get_last_recipient(token: str = Query(...)):
    """Get the last transfer recipient for quick re-send"""
    db = get_db()
    
    partner = await get_partner_by_token(token)
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    # Find last sent transfer
    last_transfer = await db.partner_transfers.find_one(
        {"sender_id": partner.get("id")},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not last_transfer:
        return {"last_recipient": None}
    
    return {
        "last_recipient": {
            "partner_number": last_transfer.get("recipient_number"),
            "name": last_transfer.get("recipient_name"),
            "last_amount": last_transfer.get("amount"),
            "last_message": last_transfer.get("message")
        }
    }
