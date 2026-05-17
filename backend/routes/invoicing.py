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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_scan_code() -> str:
    return f"BBINV-{secrets.token_hex(5).upper()}"


def _invoice_public_payload(invoice: dict) -> dict:
    return {
        "invoice_id": invoice.get("invoice_id"),
        "invoice_number": invoice.get("invoice_number"),
        "scan_code": invoice.get("scan_code"),
        "client_name": invoice.get("client_name", ""),
        "items": invoice.get("items", []),
        "subtotal": invoice.get("subtotal", 0),
        "tax": invoice.get("tax", 0),
        "tax_rate": invoice.get("tax_rate", 19),
        "total": invoice.get("total", 0),
        "notes": invoice.get("notes", ""),
        "due_days": invoice.get("due_days", 14),
        "status": invoice.get("status", "sent"),
        "created_at": invoice.get("created_at"),
        "paid_at": invoice.get("paid_at"),
    }

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
        "scan_code": _make_scan_code(),
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
        "created_at": _now_iso(),
    }
    await db.invoices.insert_one(invoice)
    return {
        "ok": True,
        "invoice_id": invoice["invoice_id"],
        "invoice_number": inv_num,
        "scan_code": invoice["scan_code"],
        "pay_url": f"/invoice/pay/{invoice['scan_code']}",
        "total": total,
        "message": f"Rechnung {inv_num} erstellt: {total} EUR",
    }

@router.get("/my-invoices")
async def my_invoices(request: Request):
    user = await get_current_user(request)
    invoices = await db.invoices.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"invoices": invoices}

@router.post("/mark-paid/{invoice_id}")
async def mark_paid(invoice_id: str, request: Request):
    user = await get_current_user(request)
    await db.invoices.update_one({"invoice_id": invoice_id, "user_email": user.get("email", "")}, {"$set": {"status": "paid", "paid_at": _now_iso()}})
    return {"ok": True, "message": "Rechnung als bezahlt markiert!"}


@router.get("/public/{scan_code}")
async def public_invoice(scan_code: str):
    invoice = await db.invoices.find_one(
        {"$or": [{"scan_code": scan_code.upper()}, {"invoice_id": scan_code}, {"invoice_number": scan_code.upper()}]},
        {"_id": 0},
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return _invoice_public_payload(invoice)


@router.post("/public/{scan_code}/pay")
async def pay_invoice(scan_code: str, request: Request):
    user = await get_current_user(request)
    invoice = await db.invoices.find_one(
        {"$or": [{"scan_code": scan_code.upper()}, {"invoice_id": scan_code}, {"invoice_number": scan_code.upper()}]},
        {"_id": 0},
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    if invoice.get("status") == "paid":
        raise HTTPException(status_code=409, detail="Rechnung wurde bereits bezahlt")

    issuer = await db.users.find_one({"email": invoice.get("user_email", "")})
    if not issuer:
        raise HTTPException(status_code=404, detail="Rechnungssteller nicht gefunden")

    total = round(float(invoice.get("total", 0) or 0), 2)
    if float(user.get("balance", 0) or 0) < total:
        raise HTTPException(status_code=402, detail=f"Nicht genug Guthaben (benötigt: €{total:.2f})")

    now = _now_iso()
    reference = invoice.get("invoice_id") or invoice.get("invoice_number") or scan_code

    await db.users.update_one({"_id": user["_id"], "balance": {"$gte": total}}, {"$inc": {"balance": -total}})
    await db.users.update_one({"_id": issuer["_id"]}, {"$inc": {"balance": total}})

    await db.transactions.insert_many([
        {
            "id": secrets.token_hex(8),
            "user_id": str(user["_id"]),
            "type": "invoice_payment",
            "amount": -total,
            "description": f"Rechnung bezahlt {reference}",
            "status": "completed",
            "reference": reference,
            "category": "invoice",
            "counterparty_email": invoice.get("user_email", ""),
            "created_at": now,
        },
        {
            "id": secrets.token_hex(8),
            "user_id": str(issuer["_id"]),
            "type": "invoice_payment_received",
            "amount": total,
            "description": f"Rechnung bezahlt {reference}",
            "status": "completed",
            "reference": reference,
            "category": "invoice",
            "counterparty_email": user.get("email", ""),
            "created_at": now,
        },
    ])

    await db.invoices.update_one(
        {"invoice_id": invoice.get("invoice_id")},
        {"$set": {"status": "paid", "paid_at": now, "paid_by_email": user.get("email", ""), "paid_by_user_id": str(user["_id"])}},
    )
    paid_invoice = dict(invoice)
    paid_invoice.update({"status": "paid", "paid_at": now})
    return {"ok": True, "invoice": _invoice_public_payload(paid_invoice), "message": "Rechnung erfolgreich bezahlt"}
