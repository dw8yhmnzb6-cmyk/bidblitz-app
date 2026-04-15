"""
BidBlitz V2 - Rechnungsgenerator & Invoicing
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets
from typing import List

router = APIRouter(prefix="/api/invoicing", tags=["invoicing"])

class InvoiceItem(BaseModel):
    description: str
    quantity: int = 1
    unit_price: float = Field(..., gt=0)

class CreateInvoice(BaseModel):
    client_name: str
    client_email: str = ""
    items: List[InvoiceItem]
    notes: str = ""
    due_days: int = 14

@router.post("/create")
async def create_invoice(req: CreateInvoice, request: Request):
    user = await get_current_user(request)
    subtotal = sum(i.quantity * i.unit_price for i in req.items)
    tax = round(subtotal * 0.19, 2)
    total = round(subtotal + tax, 2)
    inv_num = f"INV-{datetime.now().strftime('%Y%m')}-{secrets.token_hex(3).upper()}"
    invoice = {
        "invoice_id": f"inv_{secrets.token_hex(6)}",
        "invoice_number": inv_num,
        "user_email": user.get("email", ""),
        "client_name": req.client_name,
        "client_email": req.client_email,
        "items": [{"description": i.description, "quantity": i.quantity, "unit_price": i.unit_price, "total": round(i.quantity * i.unit_price, 2)} for i in req.items],
        "subtotal": round(subtotal, 2),
        "tax": tax,
        "tax_rate": 19,
        "total": total,
        "notes": req.notes,
        "due_days": req.due_days,
        "status": "sent",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one(invoice)
    return {"ok": True, "invoice_id": invoice["invoice_id"], "invoice_number": inv_num, "total": total, "message": f"Rechnung {inv_num} erstellt: {total} EUR"}

@router.get("/my-invoices")
async def my_invoices(request: Request):
    user = await get_current_user(request)
    invoices = await db.invoices.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"invoices": invoices}

@router.post("/mark-paid/{invoice_id}")
async def mark_paid(invoice_id: str, request: Request):
    user = await get_current_user(request)
    await db.invoices.update_one({"invoice_id": invoice_id, "user_email": user.get("email", "")}, {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "message": "Rechnung als bezahlt markiert!"}
