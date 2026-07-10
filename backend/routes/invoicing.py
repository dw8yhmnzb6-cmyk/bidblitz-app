"""BidBlitz V2 - Rechnungen, Task-Center, Client-Health & Reminder MVP."""

import asyncio
import base64
import csv
import io
import secrets
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional
from urllib.parse import quote

import qrcode
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pymongo import ReturnDocument
from pydantic import BaseModel, Field
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from core.audit import get_client_info, log_audit
from core.config import STRIPE_API_KEY
from core.database import db
from core.email import FRONTEND_URL, get_base_template, send_email_detailed
from core.security import get_current_user
from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest, StripeCheckout

router = APIRouter(prefix="/api/invoicing", tags=["invoicing"])
public_router = APIRouter(prefix="/api/pay", tags=["invoice-payments"])
webhook_router = APIRouter(tags=["stripe-webhook"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _make_scan_code() -> str:
    return f"BBINV-{secrets.token_hex(5).upper()}"


def _make_payment_token() -> str:
    return secrets.token_urlsafe(24)


def _make_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


def _norm_text(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _client_key(name: str, email: str) -> str:
    if email and email.strip():
        return f"email:{email.strip().lower()}"
    return f"name:{_norm_text(name)}"


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _iso_after_days(days: int, base: Optional[datetime] = None) -> str:
    return ((base or _now()) + timedelta(days=days)).isoformat()


def _format_date_short(value: Optional[str]) -> str:
    parsed = _parse_iso(value)
    if not parsed:
        return "—"
    return parsed.strftime("%d.%m.%Y")


def _advance_date(value: Optional[str], frequency: str) -> str:
    base = _parse_iso(value) or _now()
    if frequency == "weekly":
        return (base + timedelta(days=7)).isoformat()
    return (base + timedelta(days=30)).isoformat()


def _public_pay_url(scan_code: str, origin: str = "") -> str:
    base = (origin or FRONTEND_URL or "").rstrip("/")
    path = f"/invoice/pay/{scan_code}"
    return f"{base}{path}" if base else path


def _secure_pay_url(token: str, origin: str = "") -> str:
    base = (origin or FRONTEND_URL or "").rstrip("/")
    path = f"/pay/{token}"
    return f"{base}{path}" if base else path


def _host_origin(request: Request, provided_origin: str = "") -> str:
    if provided_origin:
        return provided_origin.rstrip("/")
    origin = (request.headers.get("origin") or "").rstrip("/")
    if origin:
        return origin
    return (FRONTEND_URL or "").rstrip("/")


def _share_links(public_url: str, invoice: dict) -> dict:
    invoice_number = invoice.get("invoice_number", "Rechnung")
    amount = round(float(invoice.get("total", 0) or 0), 2)
    text = f"Bitte bezahle {invoice_number} über diesen sicheren BidBlitz-Link: {public_url}"
    mail_subject = quote(f"Zahlungslink {invoice_number}")
    mail_body = quote(f"Hallo,\n\nbitte bezahle {invoice_number} ({amount:.2f} EUR) hier:\n{public_url}\n\nDanke.")
    return {
        "copy": public_url,
        "whatsapp": f"https://wa.me/?text={quote(text)}",
        "sms": f"sms:?body={quote(text)}",
        "email": f"mailto:?subject={mail_subject}&body={mail_body}",
    }


def _reminder_subject(invoice: dict, kind: str) -> str:
    if kind == "manual":
        label = "Sicherer Zahlungslink"
    else:
        label = "Überfällige Rechnung" if kind == "overdue" else "Zahlungserinnerung"
    return f"{label}: {invoice.get('invoice_number', 'Rechnung')}"


def _reminder_html(invoice: dict, payment_link: str, kind: str) -> str:
    overdue = kind == "overdue"
    manual = kind == "manual"
    accent = "#00E89D" if manual else ("#FF8E53" if overdue else "#00C2FF")
    headline = "Dein sicherer BidBlitz Zahlungslink" if manual else ("Deine Rechnung ist überfällig" if overdue else "Freundliche Zahlungserinnerung")
    total = float(invoice.get("total", 0) or 0)
    due_at = invoice.get("due_at") or ""
    intro = "Hier ist dein sicherer Link, um die Rechnung direkt per BidBlitz Pay zu bezahlen." if manual else f"Bitte begleiche die Rechnung <strong style=\"color:#fff;\">{invoice.get('invoice_number')}</strong>. Offener Betrag: <strong style=\"color:{accent};\">€{total:.2f}</strong>."
    content = f"""
        <h2 style=\"color:#fff;font-size:18px;margin:0 0 15px;\">{headline}</h2>
        <p style=\"color:#AAA;font-size:14px;line-height:1.6;margin:0 0 18px;\">Hallo {invoice.get('client_name') or 'liebes Team'},</p>
        <p style=\"color:#AAA;font-size:14px;line-height:1.6;margin:0 0 25px;\">
            {intro}
        </p>
        <div style=\"background:#111;border-radius:12px;padding:18px;margin:0 0 24px;\">
            <table width=\"100%\" style=\"border-collapse:collapse;\">
                <tr>
                    <td style=\"color:#666;font-size:13px;padding:6px 0;\">Rechnung</td>
                    <td style=\"color:#fff;font-size:13px;text-align:right;\">{invoice.get('invoice_number')}</td>
                </tr>
                <tr>
                    <td style=\"color:#666;font-size:13px;padding:6px 0;\">Fällig</td>
                    <td style=\"color:#fff;font-size:13px;text-align:right;\">{due_at[:10] if due_at else '—'}</td>
                </tr>
                <tr>
                    <td style=\"color:#666;font-size:13px;padding:6px 0;\">Status</td>
                    <td style=\"color:{accent};font-size:13px;text-align:right;font-weight:700;\">{'Zahlungslink' if manual else ('Überfällig' if overdue else 'Offen')}</td>
                </tr>
            </table>
        </div>
        <a href=\"{payment_link}\" style=\"display:inline-block;padding:14px 28px;background:{accent};color:#050505;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;\">
            Mit BidBlitz Pay bezahlen
        </a>
        <p style=\"color:#666;font-size:12px;margin:22px 0 0;\">{('Falls du Fragen hast, antworte einfach auf diese Nachricht.' if manual else 'Falls die Zahlung bereits erfolgt ist, kannst du diese Nachricht ignorieren.')}</p>
    """
    return get_base_template(content, _reminder_subject(invoice, kind))


async def _get_payment_link_by_invoice(invoice: dict, origin: str = "", force_refresh: bool = False) -> dict:
    invoice_id = invoice.get("invoice_id")
    if not invoice_id:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    now_iso = _now_iso()
    existing = await db.payment_links.find_one(
        {"invoice_id": invoice_id, "status": {"$nin": ["replaced", "cancelled", "expired"]}},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    token = existing.get("token") if existing and not force_refresh else _make_payment_token()
    link_id = existing.get("link_id") if existing and not force_refresh else _make_id("plink")
    public_url = _secure_pay_url(token, origin)
    status = "paid" if invoice.get("status") == "paid" else "active"

    payload = {
        "link_id": link_id,
        "invoice_id": invoice_id,
        "invoice_number": invoice.get("invoice_number"),
        "owner_user_id": invoice.get("owner_user_id", ""),
        "owner_user_email": invoice.get("user_email", ""),
        "client_name": invoice.get("client_name", ""),
        "client_email": invoice.get("client_email", ""),
        "amount": round(float(invoice.get("total", 0) or 0), 2),
        "currency": "EUR",
        "token": token,
        "status": status,
        "payment_status": "paid" if invoice.get("status") == "paid" else "pending",
        "public_url": public_url,
        "updated_at": now_iso,
    }

    if existing and force_refresh:
        await db.payment_links.update_many(
            {"invoice_id": invoice_id, "status": {"$in": ["active", "processing"]}},
            {"$set": {"status": "replaced", "updated_at": now_iso}},
        )

    await db.payment_links.update_one(
        {"link_id": link_id},
        {
            "$set": payload,
            "$setOnInsert": {
                "created_at": existing.get("created_at") if existing and not force_refresh else now_iso,
                "paid_at": existing.get("paid_at") if existing else None,
                "paid_via": existing.get("paid_via") if existing else None,
                "stripe_session_id": existing.get("stripe_session_id") if existing else None,
                "payment_reference": existing.get("payment_reference") if existing else None,
            },
        },
        upsert=True,
    )

    await db.invoices.update_one(
        {"invoice_id": invoice_id},
        {
            "$set": {
                "payment_link_id": link_id,
                "payment_link_token": token,
                "payment_link_url": public_url,
                "public_pay_url": public_url,
                "updated_at": now_iso,
            }
        },
    )

    result = {**payload}
    result["share_links"] = _share_links(public_url, invoice)
    result["qr_value"] = public_url
    result["pdf_url"] = f"/api/invoicing/{invoice_id}/payment-pdf"
    return result


async def _payment_links_map(invoices: List[dict], origin: str = "") -> Dict[str, dict]:
    if not invoices:
        return {}
    invoice_ids = [invoice.get("invoice_id") for invoice in invoices if invoice.get("invoice_id")]
    rows = await db.payment_links.find(
        {"invoice_id": {"$in": invoice_ids}, "status": {"$nin": ["replaced", "cancelled", "expired"]}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)

    mapped: Dict[str, dict] = {}
    for row in rows:
        invoice_id = row.get("invoice_id")
        if invoice_id and invoice_id not in mapped:
            public_url = row.get("public_url") or _secure_pay_url(row.get("token", ""), origin)
            mapped[invoice_id] = {
                **row,
                "public_url": public_url,
                "share_links": _share_links(public_url, {"invoice_number": row.get("invoice_number"), "total": row.get("amount")}),
                "qr_value": public_url,
                "pdf_url": f"/api/invoicing/{invoice_id}/payment-pdf",
            }

    missing = [invoice for invoice in invoices if invoice.get("invoice_id") and invoice.get("invoice_id") not in mapped]
    for invoice in missing:
        mapped[invoice["invoice_id"]] = await _get_payment_link_by_invoice(invoice, origin)
    return mapped


async def _get_invoice_and_link_by_token(token: str, origin: str = "") -> tuple[dict, dict]:
    link = await db.payment_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Zahlungslink nicht gefunden")
    invoice = await db.invoices.find_one({"invoice_id": link.get("invoice_id")}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    if invoice.get("status") == "paid" and link.get("status") != "paid":
        await db.payment_links.update_one(
            {"token": token},
            {"$set": {"status": "paid", "payment_status": "paid", "updated_at": _now_iso()}},
        )
        link["status"] = "paid"
        link["payment_status"] = "paid"
    link_payload = {
        **link,
        "public_url": link.get("public_url") or _secure_pay_url(token, origin),
    }
    link_payload["share_links"] = _share_links(link_payload["public_url"], invoice)
    link_payload["qr_value"] = link_payload["public_url"]
    link_payload["pdf_url"] = f"/api/invoicing/{invoice.get('invoice_id')}/payment-pdf"
    return invoice, link_payload


async def _mark_invoice_paid(invoice: dict, link: dict, now_iso: str, method: str, payer_email: str = "", payer_user_id: str = "", payment_reference: str = "") -> dict:
    invoice_id = invoice.get("invoice_id")
    updated = await db.invoices.find_one_and_update(
        {"invoice_id": invoice_id, "status": {"$ne": "paid"}},
        {
            "$set": {
                "status": "paid",
                "paid_at": now_iso,
                "paid_by_email": payer_email,
                "paid_by_user_id": payer_user_id,
                "payment_method": method,
                "payment_reference": payment_reference,
                "updated_at": now_iso,
            }
        },
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        current = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
        await db.payment_links.update_one(
            {"token": link.get("token")},
            {"$set": {"status": "paid", "payment_status": "paid", "updated_at": now_iso}},
        )
        return current or invoice

    await db.payment_links.update_one(
        {"token": link.get("token")},
        {
            "$set": {
                "status": "paid",
                "payment_status": "paid",
                "paid_at": now_iso,
                "paid_via": method,
                "payment_reference": payment_reference,
                "updated_at": now_iso,
            }
        },
    )
    return updated


async def _create_invoice_payment_pdf(invoice: dict, payment_link: dict) -> bytes:
    public_url = payment_link.get("public_url") or _secure_pay_url(payment_link.get("token", ""), FRONTEND_URL)
    buf = io.BytesIO()
    pdf = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    pdf.setFillColorRGB(0.03, 0.04, 0.07)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)

    pdf.setFillColorRGB(0.0, 0.76, 1.0)
    pdf.roundRect(18 * mm, height - 42 * mm, width - 36 * mm, 22 * mm, 8 * mm, fill=1, stroke=0)
    pdf.setFillColorRGB(0.02, 0.03, 0.05)
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(24 * mm, height - 28 * mm, "BidBlitz Smart Invoice")

    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(20 * mm, height - 58 * mm, invoice.get("invoice_number", "Rechnung"))
    pdf.setFont("Helvetica", 10)
    pdf.setFillColorRGB(0.72, 0.78, 0.88)
    pdf.drawString(20 * mm, height - 64 * mm, f"Kunde: {invoice.get('client_name', '—')}")
    pdf.drawString(20 * mm, height - 70 * mm, f"Fällig: {_format_date_short(invoice.get('due_at'))}")
    pdf.drawString(20 * mm, height - 76 * mm, f"Betrag: €{float(invoice.get('total', 0) or 0):.2f}")

    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(public_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    qr_buffer = io.BytesIO()
    img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    pdf.drawImage(ImageReader(qr_buffer), width - 70 * mm, height - 98 * mm, 42 * mm, 42 * mm, mask="auto")

    pdf.setFillColorRGB(0.82, 0.86, 0.92)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(20 * mm, height - 94 * mm, "Sicherer Zahlungslink")
    pdf.setFont("Helvetica", 9)
    text_obj = pdf.beginText(20 * mm, height - 100 * mm)
    text_obj.setFillColorRGB(0.82, 0.86, 0.92)
    safe_chunks = [public_url[i:i + 68] for i in range(0, len(public_url), 68)]
    for line in safe_chunks[:4]:
        text_obj.textLine(line)
    pdf.drawText(text_obj)

    y = height - 124 * mm
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(20 * mm, y, "Rechnungspositionen")
    y -= 8 * mm
    pdf.setFont("Helvetica", 10)
    for item in invoice.get("items", [])[:10]:
        pdf.setFillColorRGB(0.85, 0.88, 0.92)
        pdf.drawString(20 * mm, y, f"{item.get('quantity', 1)} × {item.get('description', 'Position')}")
        pdf.drawRightString(width - 20 * mm, y, f"€{float(item.get('total', 0) or 0):.2f}")
        y -= 6 * mm

    y -= 4 * mm
    pdf.setFillColorRGB(0.0, 0.90, 0.62)
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawRightString(width - 20 * mm, y, f"Gesamt: €{float(invoice.get('total', 0) or 0):.2f}")
    y -= 10 * mm
    pdf.setFillColorRGB(0.72, 0.78, 0.88)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(20 * mm, y, "Zahlbar per Karte, Apple Pay, Google Pay oder eingeloggt mit BidBlitz Wallet.")

    pdf.showPage()
    pdf.save()
    buf.seek(0)
    return buf.getvalue()


def _invoice_public_payload(invoice: dict, origin: str = "") -> dict:
    due_at = invoice.get("due_at") or _iso_after_days(int(invoice.get("due_days", 14) or 14), _parse_iso(invoice.get("issue_date") or invoice.get("created_at")))
    status = invoice.get("status", "sent")
    overdue = status != "paid" and (_parse_iso(due_at) or _now()) < _now()
    pay_url = invoice.get("pay_url") or f"/invoice/pay/{invoice.get('scan_code')}"
    public_pay_url = invoice.get("public_pay_url") or _public_pay_url(invoice.get("scan_code", ""), origin)
    reminder_count = int(invoice.get("reminder_count", 0) or 0)
    return {
        "invoice_id": invoice.get("invoice_id"),
        "invoice_number": invoice.get("invoice_number"),
        "scan_code": invoice.get("scan_code"),
        "client_name": invoice.get("client_name", ""),
        "client_email": invoice.get("client_email", ""),
        "client_key": invoice.get("client_key") or _client_key(invoice.get("client_name", ""), invoice.get("client_email", "")),
        "items": invoice.get("items", []),
        "subtotal": round(float(invoice.get("subtotal", 0) or 0), 2),
        "tax": round(float(invoice.get("tax", 0) or 0), 2),
        "tax_rate": invoice.get("tax_rate", 19),
        "total": round(float(invoice.get("total", 0) or 0), 2),
        "notes": invoice.get("notes", ""),
        "due_days": int(invoice.get("due_days", 14) or 14),
        "due_at": due_at,
        "issue_date": invoice.get("issue_date") or invoice.get("created_at"),
        "status": status,
        "is_overdue": overdue,
        "created_at": invoice.get("created_at"),
        "updated_at": invoice.get("updated_at"),
        "paid_at": invoice.get("paid_at"),
        "pay_url": pay_url,
        "public_pay_url": public_pay_url,
        "payment_link_token": invoice.get("payment_link_token"),
        "payment_link_url": invoice.get("payment_link_url") or public_pay_url,
        "qr_value": invoice.get("payment_link_url") or public_pay_url,
        "payment_pdf_url": f"/api/invoicing/{invoice.get('invoice_id')}/payment-pdf",
        "reminder_count": reminder_count,
        "last_reminder_at": invoice.get("last_reminder_at"),
        "recurring": invoice.get("recurring") or {"enabled": False, "frequency": None, "next_invoice_date": None},
    }


def _invoice_items(items: List["InvoiceItem"]) -> List[dict]:
    return [
        {
            "description": item.description,
            "quantity": int(item.quantity or 1),
            "unit_price": round(float(item.unit_price or 0), 2),
            "total": round(float(item.quantity or 1) * float(item.unit_price or 0), 2),
        }
        for item in items
    ]


def _score_payload(score: int) -> dict:
    if score >= 75:
        return {"value": score, "status": "green", "label": "Healthy"}
    if score >= 45:
        return {"value": score, "status": "yellow", "label": "Warning"}
    return {"value": score, "status": "red", "label": "Critical"}


def _task_priority(days_left: Optional[int], is_overdue: bool = False) -> str:
    if is_overdue or (days_left is not None and days_left <= 2):
        return "urgent"
    if days_left is not None and days_left <= 7:
        return "high"
    return "normal"


def _default_client_doc(owner_user_id: str, owner_user_email: str, company_name: str, owner_name: str, email: str) -> dict:
    now = _now_iso()
    return {
        "client_id": _make_id("cli"),
        "owner_user_id": owner_user_id,
        "owner_user_email": owner_user_email,
        "client_key": _client_key(company_name, email),
        "company_name": company_name,
        "owner_name": owner_name or company_name,
        "email": email.strip().lower(),
        "phone": "",
        "nui": "",
        "vat_number": "",
        "required_document_count": 4,
        "uploaded_document_count": 0,
        "pending_review_count": 0,
        "next_filing_due_at": (_now() + timedelta(days=7)).isoformat(),
        "last_upload_at": None,
        "locked": False,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }


async def _ensure_client(owner_user_id: str, owner_user_email: str, client_name: str, client_email: str) -> None:
    company_name = (client_name or "Unbenannter Mandant").strip()
    email = (client_email or "").strip().lower()
    base = _default_client_doc(owner_user_id, owner_user_email, company_name, company_name, email)
    insert_doc = {k: v for k, v in base.items() if k not in {"company_name", "owner_name", "email", "updated_at"}}
    await db.accountant_clients.update_one(
        {"owner_user_id": owner_user_id, "client_key": base["client_key"]},
        {
            "$set": {
                "company_name": company_name,
                "owner_name": company_name,
                "email": email,
                "updated_at": _now_iso(),
            },
            "$setOnInsert": insert_doc,
        },
        upsert=True,
    )


async def _invoice_reminder_map(invoice_ids: List[str]) -> dict:
    if not invoice_ids:
        return {}
    rows = await db.invoice_reminders.find({"invoice_id": {"$in": invoice_ids}}, {"_id": 0}).sort("sent_at", -1).to_list(500)
    mapped: dict[str, dict] = {}
    for row in rows:
        invoice_id = row.get("invoice_id")
        if invoice_id not in mapped:
            mapped[invoice_id] = {"count": 0, "last": row.get("sent_at")}
        mapped[invoice_id]["count"] += 1
    return mapped


async def _load_subscription(user_id: str) -> Optional[dict]:
    rows = await db.subscriptions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
    return rows[0] if rows else None


async def _load_bank_transactions(user_id: str, user_email: str) -> List[dict]:
    rows = await db.transactions.find(
        {"$or": [{"user_id": user_id}, {"user_email": user_email}, {"counterparty_email": user_email}]},
        {"_id": 0},
    ).sort("created_at", -1).limit(300).to_list(300)
    result = []
    for row in rows:
        marker = " ".join([
            str(row.get("type", "")).lower(),
            str(row.get("category", "")).lower(),
            str(row.get("description", "")).lower(),
        ])
        has_bank_marker = "bank" in marker or row.get("reconciliation_status") is not None
        matched = row.get("reconciliation_status") in {"matched", "matched_manual"} or bool(row.get("matched_invoice_id"))
        if has_bank_marker and not matched:
            result.append(row)
    return result


def _client_health(client: dict, invoices: List[dict], bank_items: List[dict]) -> dict:
    now = _now()
    missing_documents = max(int(client.get("required_document_count", 0) or 0) - int(client.get("uploaded_document_count", 0) or 0), 0)
    pending_reviews = int(client.get("pending_review_count", 0) or 0)
    due_dt = _parse_iso(client.get("next_filing_due_at"))
    filing_due_soon = 1 if due_dt and (due_dt - now).days <= 10 else 0
    overdue_invoices = 0
    outstanding_total = 0.0
    for inv in invoices:
        total = float(inv.get("total", 0) or 0)
        if inv.get("status") != "paid":
            outstanding_total += total
            if _invoice_public_payload(inv).get("is_overdue"):
                overdue_invoices += 1
    email = (client.get("email") or "").strip().lower()
    unmatched_bank = len([row for row in bank_items if not email or (row.get("counterparty_email", "").strip().lower() == email)])
    last_upload_at = _parse_iso(client.get("last_upload_at"))
    inactive_uploads = 1 if not last_upload_at or (now - last_upload_at).days > 30 else 0

    score = 100 - (missing_documents * 12) - (overdue_invoices * 18) - (filing_due_soon * 12) - (unmatched_bank * 8) - (inactive_uploads * 10) - (pending_reviews * 6)
    score = max(0, min(100, score))
    reasons = []
    if missing_documents:
        reasons.append({"key": "missing_documents", "label": f"{missing_documents} fehlende Belege"})
    if overdue_invoices:
        reasons.append({"key": "overdue_invoices", "label": f"{overdue_invoices} überfällige Rechnungen"})
    if filing_due_soon:
        reasons.append({"key": "filing_due", "label": "Abgabe bald fällig"})
    if unmatched_bank:
        reasons.append({"key": "unmatched_bank", "label": f"{unmatched_bank} ungeklärte Bankposten"})
    if inactive_uploads:
        reasons.append({"key": "inactive_uploads", "label": "Keine aktuellen Uploads"})
    if pending_reviews:
        reasons.append({"key": "pending_reviews", "label": f"{pending_reviews} Prüfungen offen"})

    return {
        "score": _score_payload(score),
        "reasons": reasons,
        "metrics": {
            "missing_documents": missing_documents,
            "pending_reviews": pending_reviews,
            "overdue_invoices": overdue_invoices,
            "unmatched_bank": unmatched_bank,
            "filing_due_soon": filing_due_soon,
            "inactive_uploads": inactive_uploads,
            "outstanding_total": round(outstanding_total, 2),
        },
    }


async def _build_dashboard(user: dict) -> dict:
    user_id = str(user.get("_id"))
    user_email = user.get("email", "")
    invoices = await db.invoices.find({"user_email": user_email}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    clients = await db.accountant_clients.find({"owner_user_id": user_id}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    bank_items = await _load_bank_transactions(user_id, user_email)
    subscription = await _load_subscription(user_id)
    completed = await db.accountant_task_state.find({"owner_user_id": user_id, "status": "completed"}, {"_id": 0}).sort("completed_at", -1).limit(100).to_list(100)

    invoices_by_client: dict[str, List[dict]] = {}
    for inv in invoices:
        key = inv.get("client_key") or _client_key(inv.get("client_name", ""), inv.get("client_email", ""))
        invoices_by_client.setdefault(key, []).append(inv)

    clients_map = {c.get("client_key"): c for c in clients}
    for key, invs in invoices_by_client.items():
        if key not in clients_map and invs:
            first = invs[0]
            clients_map[key] = {
                **_default_client_doc(user_id, user_email, first.get("client_name", "Mandant"), first.get("client_name", "Mandant"), first.get("client_email", "")),
                "client_key": key,
                "client_id": _make_id("cli"),
                "created_at": first.get("created_at") or _now_iso(),
                "updated_at": first.get("updated_at") or first.get("created_at") or _now_iso(),
            }

    client_rows = []
    active_tasks = []
    now = _now()

    for client in clients_map.values():
        client_key = client.get("client_key")
        client_invoices = invoices_by_client.get(client_key, [])
        health = _client_health(client, client_invoices, bank_items)
        metrics = health["metrics"]
        due_dt = _parse_iso(client.get("next_filing_due_at"))
        days_to_due = (due_dt - now).days if due_dt else None

        client_rows.append({
            "client_id": client.get("client_id"),
            "client_key": client_key,
            "company_name": client.get("company_name") or client.get("owner_name") or "Mandant",
            "owner_name": client.get("owner_name") or client.get("company_name") or "Mandant",
            "email": client.get("email", ""),
            "phone": client.get("phone", ""),
            "nui": client.get("nui", ""),
            "vat_number": client.get("vat_number", ""),
            "locked": bool(client.get("locked", False)),
            "status": client.get("status", "active"),
            "health": health,
            "next_filing_due_at": client.get("next_filing_due_at"),
            "last_upload_at": client.get("last_upload_at"),
            "invoice_count": len(client_invoices),
            "open_invoice_count": len([inv for inv in client_invoices if inv.get("status") != "paid"]),
            "outstanding_total": metrics["outstanding_total"],
        })

        if metrics["missing_documents"]:
            active_tasks.append({
                "task_id": f"missing-docs:{client.get('client_id')}",
                "task_type": "missing_documents",
                "status": "pending",
                "priority": "urgent" if metrics["missing_documents"] >= 3 else "high",
                "title": "Fehlende Dokumente",
                "description": f"{metrics['missing_documents']} Belege fehlen für {client.get('company_name')}",
                "company": client.get("company_name"),
                "client_id": client.get("client_id"),
                "ref_id": client.get("client_id"),
                "due_at": client.get("next_filing_due_at"),
                "action": "complete_task",
                "action_label": "Als erledigt markieren",
                "can_complete": True,
            })
        if metrics["pending_reviews"]:
            active_tasks.append({
                "task_id": f"pending-review:{client.get('client_id')}",
                "task_type": "pending_review",
                "status": "pending",
                "priority": "high",
                "title": "Prüfung ausstehend",
                "description": f"{metrics['pending_reviews']} Dokumente warten auf Review",
                "company": client.get("company_name"),
                "client_id": client.get("client_id"),
                "ref_id": client.get("client_id"),
                "due_at": client.get("updated_at"),
                "action": "complete_task",
                "action_label": "Review abschließen",
                "can_complete": True,
            })
        if metrics["filing_due_soon"]:
            active_tasks.append({
                "task_id": f"filing:{client.get('client_id')}",
                "task_type": "filing_due_soon",
                "status": "pending",
                "priority": _task_priority(days_to_due),
                "title": "Abgabe bald fällig",
                "description": f"Nächste Abgabe für {client.get('company_name')} steht an",
                "company": client.get("company_name"),
                "client_id": client.get("client_id"),
                "ref_id": client.get("client_id"),
                "due_at": client.get("next_filing_due_at"),
                "action": "complete_task",
                "action_label": "Auf nächsten Termin schieben",
                "can_complete": True,
            })

    for inv in invoices:
        payload = _invoice_public_payload(inv)
        if payload["status"] != "paid":
            due_dt = _parse_iso(payload.get("due_at"))
            days_to_due = (due_dt - now).days if due_dt else None
            active_tasks.append({
                "task_id": f"invoice:{payload['invoice_id']}",
                "task_type": "unpaid_invoice",
                "status": "pending",
                "priority": _task_priority(days_to_due, payload.get("is_overdue", False)),
                "title": "Unbezahlte Rechnung",
                "description": f"{payload['invoice_number']} · €{payload['total']:.2f}",
                "company": payload.get("client_name") or "Mandant",
                "client_id": None,
                "ref_id": payload.get("invoice_id"),
                "invoice_id": payload.get("invoice_id"),
                "due_at": payload.get("due_at"),
                "action": "send_reminder",
                "action_label": "Reminder senden",
                "can_complete": False,
                "is_overdue": payload.get("is_overdue", False),
            })

    for row in bank_items[:25]:
        created_at = row.get("created_at") or row.get("date") or _now_iso()
        active_tasks.append({
            "task_id": f"bank:{row.get('id') or row.get('reference') or secrets.token_hex(4)}",
            "task_type": "unmatched_bank_transaction",
            "status": "pending",
            "priority": "high",
            "title": "Bankposten ungeklärt",
            "description": row.get("description") or row.get("reference") or "Banktransaktion",
            "company": row.get("counterparty_email") or "Bankkonto",
            "client_id": None,
            "ref_id": row.get("id") or row.get("reference"),
            "due_at": created_at,
            "action": "complete_task",
            "action_label": "Als abgeglichen markieren",
            "can_complete": True,
        })

    if subscription and (subscription.get("status") != "active" or not subscription.get("auto_renew", True) or ((_parse_iso(subscription.get("expires_at")) or now) - now).days <= 7):
        active_tasks.append({
            "task_id": f"subscription:{subscription.get('subscription_id')}",
            "task_type": "subscription_issue",
            "status": "pending",
            "priority": "high",
            "title": "Abo / Zahlung prüfen",
            "description": f"Plan {subscription.get('plan_name', subscription.get('plan', 'Abo'))} braucht Aufmerksamkeit",
            "company": user_email,
            "client_id": None,
            "ref_id": subscription.get("subscription_id"),
            "due_at": subscription.get("expires_at"),
            "action": "open_audit",
            "action_label": "Details ansehen",
            "can_complete": True,
        })

    completed_tasks = [{**row.get("snapshot", {}), "status": "completed", "completed_at": row.get("completed_at")} for row in completed if row.get("snapshot")]
    active_tasks.sort(key=lambda item: ({"urgent": 0, "high": 1, "normal": 2}.get(item.get("priority"), 3), item.get("due_at") or "9999"))
    all_tasks = active_tasks + completed_tasks

    greens = len([c for c in client_rows if c["health"]["score"]["status"] == "green"])
    yellows = len([c for c in client_rows if c["health"]["score"]["status"] == "yellow"])
    reds = len([c for c in client_rows if c["health"]["score"]["status"] == "red"])
    urgent_count = len([t for t in active_tasks if t.get("priority") == "urgent"])

    return {
        "summary": {
            "clients_total": len(client_rows),
            "urgent_tasks": urgent_count,
            "pending_tasks": len(active_tasks),
            "completed_tasks": len(completed_tasks),
            "unpaid_invoices": len([inv for inv in invoices if inv.get("status") != "paid"]),
            "green_clients": greens,
            "yellow_clients": yellows,
            "red_clients": reds,
        },
        "tasks": all_tasks,
        "clients": client_rows,
    }


async def _serialize_audit_logs(user: dict, client_id: str = "") -> List[dict]:
    query = {"$or": [{"email": user.get("email", "")}, {"details.owner_user_email": user.get("email", "")}]}
    rows = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(150).to_list(150)
    if client_id:
        rows = [row for row in rows if row.get("details", {}).get("client_id") == client_id or row.get("details", {}).get("target") == client_id]
    result = []
    for row in rows:
        details = row.get("details", {}) or {}
        result.append({
            "timestamp": row.get("timestamp"),
            "user": row.get("email") or details.get("user") or "System",
            "company": details.get("company") or details.get("client_name") or details.get("owner_user_email") or "—",
            "action": row.get("event", "—"),
            "target": details.get("target") or details.get("invoice_id") or details.get("subscription_id") or details.get("client_id") or "—",
            "status": details.get("status") or row.get("severity") or "info",
            "details": details,
        })
    return result


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
    recurring_enabled: bool = False
    recurring_frequency: Literal["weekly", "monthly"] = "monthly"
    next_invoice_date: Optional[str] = None


class UpdateInvoice(BaseModel):
    client_name: str
    client_email: str = ""
    items: List[InvoiceItem]
    notes: str = ""
    due_days: int = 14
    recurring_enabled: bool = False
    recurring_frequency: Literal["weekly", "monthly"] = "monthly"
    next_invoice_date: Optional[str] = None


class ReminderRequest(BaseModel):
    kind: Literal["payment", "overdue", "manual"] = "payment"


class PaymentLinkCheckoutRequest(BaseModel):
    method: Literal["stripe", "wallet"] = "stripe"
    origin_url: str = ""
    payer_email: str = ""


class CompleteTaskRequest(BaseModel):
    task_id: str
    task_type: str
    title: str = ""
    company: str = ""
    client_id: Optional[str] = None
    ref_id: Optional[str] = None


class ClientImportRow(BaseModel):
    company_name: str
    owner_name: str
    email: str
    phone: str = ""
    nui: str = ""
    vat_number: str = ""


class ClientImportPayload(BaseModel):
    rows: List[ClientImportRow]


def _parse_client_csv(raw_text: str) -> dict:
    cleaned = raw_text.encode("utf-8", errors="ignore").decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(cleaned))
    rows = []
    errors = []
    for idx, raw in enumerate(reader, start=2):
        normalized = {(_norm_text(k).replace(" ", "_").replace("/", "_").replace("-", "_")): (v or "").strip() for k, v in (raw or {}).items() if k}
        row = {
            "company_name": normalized.get("company_name") or normalized.get("company") or normalized.get("firma") or "",
            "owner_name": normalized.get("owner_name") or normalized.get("owner") or normalized.get("inhaber") or "",
            "email": (normalized.get("email") or "").lower(),
            "phone": normalized.get("phone") or normalized.get("telefon") or "",
            "nui": normalized.get("nui") or "",
            "vat_number": normalized.get("vat_tvsh_number") or normalized.get("vat_number") or normalized.get("tvsh_number") or normalized.get("tvsh") or normalized.get("vat") or "",
        }
        missing = [field for field in ["company_name", "owner_name", "email"] if not row[field]]
        if missing:
            errors.append({"row": idx, "error": f"Pflichtfelder fehlen: {', '.join(missing)}"})
            continue
        rows.append(row)
    return {"rows": rows, "errors": errors}


@router.post("/create")
async def create_invoice(req: CreateInvoice, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    user_email = user.get("email", "")
    subtotal = round(sum(i.quantity * i.unit_price for i in req.items), 2)
    tax = round(subtotal * 0.19, 2)
    total = round(subtotal + tax, 2)
    inv_num = f"INV-{datetime.now().strftime('%Y%m')}-{secrets.token_hex(3).upper()}"
    now_iso = _now_iso()
    scan_code = _make_scan_code()
    issue_date = now_iso
    recurring = {
        "enabled": bool(req.recurring_enabled),
        "frequency": req.recurring_frequency if req.recurring_enabled else None,
        "next_invoice_date": req.next_invoice_date or (_advance_date(issue_date, req.recurring_frequency) if req.recurring_enabled else None),
        "last_generated_at": None,
        "source_invoice_id": None,
    }
    invoice = {
        "invoice_id": f"inv_{secrets.token_hex(6)}",
        "invoice_number": inv_num,
        "scan_code": scan_code,
        "user_email": user_email,
        "owner_user_id": user_id,
        "client_name": req.client_name.strip(),
        "client_email": req.client_email.strip().lower(),
        "client_key": _client_key(req.client_name, req.client_email),
        "items": _invoice_items(req.items),
        "subtotal": subtotal,
        "tax": tax,
        "tax_rate": 19,
        "total": total,
        "notes": req.notes,
        "due_days": int(req.due_days or 14),
        "issue_date": issue_date,
        "due_at": _iso_after_days(int(req.due_days or 14), _parse_iso(issue_date)),
        "status": "sent",
        "pay_url": f"/invoice/pay/{scan_code}",
        "public_pay_url": _public_pay_url(scan_code, request.headers.get("origin", "")),
        "recurring": recurring,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.invoices.insert_one(invoice)
    payment_link = await _get_payment_link_by_invoice(invoice, request.headers.get("origin", ""))
    await _ensure_client(user_id, user_email, invoice["client_name"], invoice["client_email"])
    ip, ua = get_client_info(request)
    await log_audit(
        "invoice_created",
        user_id=user_id,
        email=user_email,
        ip=ip,
        user_agent=ua,
        details={
            "invoice_id": invoice["invoice_id"],
            "target": invoice["invoice_number"],
            "company": invoice["client_name"],
            "status": "created",
            "owner_user_email": user_email,
            "client_id": None,
        },
    )
    return {
        "ok": True,
        "invoice_id": invoice["invoice_id"],
        "invoice_number": inv_num,
        "scan_code": invoice["scan_code"],
        "pay_url": invoice["pay_url"],
        "public_pay_url": payment_link["public_url"],
        "payment_link_token": payment_link["token"],
        "total": total,
        "message": f"Rechnung {inv_num} erstellt: {total:.2f} EUR",
    }


@router.patch("/{invoice_id}")
async def update_invoice(invoice_id: str, req: UpdateInvoice, request: Request):
    user = await get_current_user(request)
    user_email = user.get("email", "")
    existing = await db.invoices.find_one({"invoice_id": invoice_id, "user_email": user_email}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    subtotal = round(sum(i.quantity * i.unit_price for i in req.items), 2)
    tax = round(subtotal * 0.19, 2)
    total = round(subtotal + tax, 2)
    recurring = {
        "enabled": bool(req.recurring_enabled),
        "frequency": req.recurring_frequency if req.recurring_enabled else None,
        "next_invoice_date": req.next_invoice_date or (_advance_date(existing.get("issue_date") or existing.get("created_at"), req.recurring_frequency) if req.recurring_enabled else None),
        "last_generated_at": (existing.get("recurring") or {}).get("last_generated_at"),
        "source_invoice_id": (existing.get("recurring") or {}).get("source_invoice_id"),
    }
    update_doc = {
        "client_name": req.client_name.strip(),
        "client_email": req.client_email.strip().lower(),
        "client_key": _client_key(req.client_name, req.client_email),
        "items": _invoice_items(req.items),
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "notes": req.notes,
        "due_days": int(req.due_days or 14),
        "due_at": _iso_after_days(int(req.due_days or 14), _parse_iso(existing.get("issue_date") or existing.get("created_at"))),
        "recurring": recurring,
        "updated_at": _now_iso(),
    }
    await db.invoices.update_one({"invoice_id": invoice_id, "user_email": user_email}, {"$set": update_doc})
    refreshed_invoice = {**existing, **update_doc, "invoice_id": invoice_id}
    await _get_payment_link_by_invoice(refreshed_invoice, request.headers.get("origin", ""))
    await _ensure_client(str(user.get("_id")), user_email, update_doc["client_name"], update_doc["client_email"])
    ip, ua = get_client_info(request)
    await log_audit(
        "invoice_edited",
        user_id=str(user.get("_id")),
        email=user_email,
        ip=ip,
        user_agent=ua,
        details={
            "invoice_id": invoice_id,
            "target": existing.get("invoice_number"),
            "company": update_doc["client_name"],
            "status": "updated",
            "owner_user_email": user_email,
            "changed_fields": ["client_name", "client_email", "items", "notes", "due_days", "recurring"],
        },
    )
    return {"ok": True, "message": "Rechnung aktualisiert"}


@router.get("/my-invoices")
async def my_invoices(request: Request):
    user = await get_current_user(request)
    invoices = await db.invoices.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(200)
    reminder_map = await _invoice_reminder_map([inv.get("invoice_id") for inv in invoices])
    origin = request.headers.get("origin", "")
    payment_links = await _payment_links_map(invoices, origin)
    payload = []
    for inv in invoices:
        reminder_info = reminder_map.get(inv.get("invoice_id"), {})
        link = payment_links.get(inv.get("invoice_id"), {})
        enriched = {
            **inv,
            "reminder_count": reminder_info.get("count", 0),
            "last_reminder_at": reminder_info.get("last"),
            "payment_link_token": link.get("token") or inv.get("payment_link_token"),
            "payment_link_url": link.get("public_url") or inv.get("payment_link_url"),
            "public_pay_url": link.get("public_url") or inv.get("public_pay_url"),
        }
        payload.append(_invoice_public_payload(enriched, origin))
    return {"invoices": payload}


@router.post("/mark-paid/{invoice_id}")
async def mark_paid(invoice_id: str, request: Request):
    user = await get_current_user(request)
    user_email = user.get("email", "")
    invoice = await db.invoices.find_one({"invoice_id": invoice_id, "user_email": user_email}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    now_iso = _now_iso()
    await db.invoices.update_one({"invoice_id": invoice_id, "user_email": user_email}, {"$set": {"status": "paid", "paid_at": now_iso, "updated_at": now_iso}})
    ip, ua = get_client_info(request)
    await log_audit(
        "invoice_paid",
        user_id=str(user.get("_id")),
        email=user_email,
        ip=ip,
        user_agent=ua,
        details={
            "invoice_id": invoice_id,
            "target": invoice.get("invoice_number"),
            "company": invoice.get("client_name"),
            "status": "paid",
            "owner_user_email": user_email,
        },
    )
    return {"ok": True, "message": "Rechnung als bezahlt markiert!"}


@router.get("/dashboard")
async def accountant_dashboard(request: Request):
    user = await get_current_user(request)
    return await _build_dashboard(user)


@router.post("/tasks/complete")
async def complete_task(req: CompleteTaskRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    user_email = user.get("email", "")
    now_iso = _now_iso()

    if req.task_type == "missing_documents" and req.client_id:
        client = await db.accountant_clients.find_one({"client_id": req.client_id, "owner_user_id": user_id}, {"_id": 0})
        if client:
            await db.accountant_clients.update_one(
                {"client_id": req.client_id, "owner_user_id": user_id},
                {"$set": {"uploaded_document_count": int(client.get("required_document_count", 4) or 4), "last_upload_at": now_iso, "updated_at": now_iso}},
            )
    elif req.task_type == "pending_review" and req.client_id:
        await db.accountant_clients.update_one(
            {"client_id": req.client_id, "owner_user_id": user_id},
            {"$set": {"pending_review_count": 0, "updated_at": now_iso}},
        )
    elif req.task_type == "filing_due_soon" and req.client_id:
        await db.accountant_clients.update_one(
            {"client_id": req.client_id, "owner_user_id": user_id},
            {"$set": {"next_filing_due_at": (_now() + timedelta(days=30)).isoformat(), "updated_at": now_iso}},
        )
    elif req.task_type == "unmatched_bank_transaction" and req.ref_id:
        await db.transactions.update_many(
            {
                "$and": [
                    {"$or": [{"id": req.ref_id}, {"reference": req.ref_id}]},
                    {"$or": [{"user_id": user_id}, {"user_email": user_email}, {"counterparty_email": user_email}]},
                ]
            },
            {"$set": {"reconciliation_status": "matched_manual", "matched_at": now_iso}},
        )

    snapshot = {
        "task_id": req.task_id,
        "task_type": req.task_type,
        "title": req.title,
        "company": req.company,
        "client_id": req.client_id,
        "ref_id": req.ref_id,
        "status": "completed",
        "priority": "normal",
    }
    await db.accountant_task_state.insert_one({
        "owner_user_id": user_id,
        "owner_user_email": user_email,
        "task_id": req.task_id,
        "status": "completed",
        "completed_at": now_iso,
        "snapshot": snapshot,
    })
    return {"ok": True, "message": "Task erledigt"}


@router.get("/clients")
async def list_clients(request: Request):
    user = await get_current_user(request)
    dashboard = await _build_dashboard(user)
    return {"clients": dashboard.get("clients", [])}


@router.get("/clients/{client_id}")
async def client_detail(client_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    client = await db.accountant_clients.find_one({"client_id": client_id, "owner_user_id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Mandant nicht gefunden")
    invoices = await db.invoices.find({"user_email": user.get("email", ""), "client_key": client.get("client_key")}, {"_id": 0}).sort("created_at", -1).to_list(100)
    bank_items = await _load_bank_transactions(user_id, user.get("email", ""))
    health = _client_health(client, invoices, bank_items)
    logs = await _serialize_audit_logs(user, client_id=client_id)
    return {
        "client": {
            **client,
            "health": health,
            "invoice_count": len(invoices),
            "open_invoice_count": len([inv for inv in invoices if inv.get("status") != "paid"]),
        },
        "invoices": [_invoice_public_payload(inv, request.headers.get("origin", "")) for inv in invoices],
        "audit_logs": logs,
    }


@router.post("/clients/{client_id}/toggle-lock")
async def toggle_client_lock(client_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    user_email = user.get("email", "")
    client = await db.accountant_clients.find_one({"client_id": client_id, "owner_user_id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Mandant nicht gefunden")
    new_state = not bool(client.get("locked", False))
    await db.accountant_clients.update_one({"client_id": client_id, "owner_user_id": user_id}, {"$set": {"locked": new_state, "updated_at": _now_iso()}})
    ip, ua = get_client_info(request)
    await log_audit(
        "client_lock_changed",
        user_id=user_id,
        email=user_email,
        ip=ip,
        user_agent=ua,
        details={
            "client_id": client_id,
            "target": client_id,
            "company": client.get("company_name"),
            "status": "locked" if new_state else "unlocked",
            "owner_user_email": user_email,
        },
    )
    return {"ok": True, "locked": new_state}


@router.post("/clients/import-preview")
async def preview_clients_csv(request: Request, file: UploadFile = File(...)):
    await get_current_user(request)
    raw = await file.read()
    parsed = _parse_client_csv(raw.decode("utf-8", errors="ignore"))
    return {"rows": parsed["rows"], "errors": parsed["errors"], "valid_count": len(parsed["rows"]), "error_count": len(parsed["errors"])}


@router.post("/clients/import")
async def import_clients(req: ClientImportPayload, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    user_email = user.get("email", "")
    success = 0
    failed = 0
    for row in req.rows:
        try:
            doc = _default_client_doc(user_id, user_email, row.company_name, row.owner_name, row.email)
            doc.update({
                "owner_name": row.owner_name,
                "phone": row.phone,
                "nui": row.nui,
                "vat_number": row.vat_number,
                "updated_at": _now_iso(),
            })
            await db.accountant_clients.update_one(
                {"owner_user_id": user_id, "client_key": doc["client_key"]},
                {"$set": doc, "$setOnInsert": {"created_at": doc["created_at"], "client_id": doc["client_id"]}},
                upsert=True,
            )
            success += 1
        except Exception:
            failed += 1
    ip, ua = get_client_info(request)
    await log_audit(
        "client_imported",
        user_id=user_id,
        email=user_email,
        ip=ip,
        user_agent=ua,
        details={"status": "completed", "imported": success, "failed": failed, "owner_user_email": user_email},
    )
    return {"ok": True, "success_count": success, "fail_count": failed}


@router.get("/audit-log")
async def invoicing_audit_log(request: Request, client_id: str = ""):
    user = await get_current_user(request)
    return {"logs": await _serialize_audit_logs(user, client_id=client_id)}


@router.get("/{invoice_id}/reminders")
async def invoice_reminders(invoice_id: str, request: Request):
    user = await get_current_user(request)
    invoice = await db.invoices.find_one({"invoice_id": invoice_id, "user_email": user.get("email", "")}, {"_id": 0, "invoice_id": 1})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    rows = await db.invoice_reminders.find({"invoice_id": invoice_id}, {"_id": 0}).sort("sent_at", -1).to_list(50)
    return {"history": rows}


@router.post("/{invoice_id}/reminders/email")
async def send_invoice_reminder(invoice_id: str, req: ReminderRequest, request: Request):
    user = await get_current_user(request)
    user_email = user.get("email", "")
    invoice = await db.invoices.find_one({"invoice_id": invoice_id, "user_email": user_email}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    if not invoice.get("client_email"):
        raise HTTPException(status_code=400, detail="Kunden-E-Mail fehlt")

    payment_link_meta = await _get_payment_link_by_invoice(invoice, request.headers.get("origin", ""))
    payment_link = payment_link_meta["public_url"]
    result = await asyncio.to_thread(
        send_email_detailed,
        invoice.get("client_email"),
        _reminder_subject(invoice, req.kind),
        _reminder_html(invoice, payment_link, req.kind),
    )
    history = {
        "id": _make_id("rem"),
        "invoice_id": invoice_id,
        "invoice_number": invoice.get("invoice_number"),
        "client_email": invoice.get("client_email"),
        "client_name": invoice.get("client_name"),
        "kind": req.kind,
        "channel": "email",
        "payment_link": payment_link,
        "payment_token": payment_link_meta["token"],
        "sent_at": _now_iso(),
        "sent_by": user_email,
        "result": result,
    }
    await db.invoice_reminders.insert_one({**history})
    await db.invoices.update_one({"invoice_id": invoice_id, "user_email": user_email}, {"$set": {"last_reminder_at": history["sent_at"]}})
    ip, ua = get_client_info(request)
    await log_audit(
        "invoice_reminder_sent",
        user_id=str(user.get("_id")),
        email=user_email,
        ip=ip,
        user_agent=ua,
        details={
            "invoice_id": invoice_id,
            "target": invoice.get("invoice_number"),
            "company": invoice.get("client_name"),
            "status": result.get("reason", "sent"),
            "owner_user_email": user_email,
        },
    )
    return {"ok": True, "history": history, "payment_link": payment_link}


@router.post("/{invoice_id}/generate-next")
async def generate_next_invoice(invoice_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    user_email = user.get("email", "")
    source = await db.invoices.find_one({"invoice_id": invoice_id, "user_email": user_email}, {"_id": 0})
    if not source:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    recurring = source.get("recurring") or {}
    if not recurring.get("enabled"):
        raise HTTPException(status_code=400, detail="Keine wiederkehrende Rechnung")

    scheduled_for = recurring.get("next_invoice_date") or _advance_date(source.get("issue_date") or source.get("created_at"), recurring.get("frequency") or "monthly")
    next_next_date = _advance_date(scheduled_for, recurring.get("frequency") or "monthly")
    scan_code = _make_scan_code()
    new_invoice = {
        **{k: v for k, v in source.items() if k not in {"invoice_id", "invoice_number", "scan_code", "status", "paid_at", "paid_by_email", "paid_by_user_id", "created_at", "updated_at", "last_reminder_at", "reminder_count", "public_pay_url", "pay_url"}},
        "invoice_id": _make_id("inv"),
        "invoice_number": f"INV-{datetime.now().strftime('%Y%m')}-{secrets.token_hex(3).upper()}",
        "scan_code": scan_code,
        "owner_user_id": user_id,
        "user_email": user_email,
        "issue_date": scheduled_for,
        "due_at": _iso_after_days(int(source.get("due_days", 14) or 14), _parse_iso(scheduled_for)),
        "status": "sent",
        "pay_url": f"/invoice/pay/{scan_code}",
        "public_pay_url": _public_pay_url(scan_code, request.headers.get("origin", "")),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "recurring": {
            "enabled": True,
            "frequency": recurring.get("frequency") or "monthly",
            "next_invoice_date": next_next_date,
            "last_generated_at": _now_iso(),
            "source_invoice_id": source.get("invoice_id"),
        },
    }
    await db.invoices.insert_one(new_invoice)
    payment_link = await _get_payment_link_by_invoice(new_invoice, request.headers.get("origin", ""))
    await db.invoices.update_one({"invoice_id": invoice_id, "user_email": user_email}, {"$set": {"recurring.next_invoice_date": next_next_date, "recurring.last_generated_at": _now_iso(), "updated_at": _now_iso()}})
    await _ensure_client(user_id, user_email, new_invoice.get("client_name", ""), new_invoice.get("client_email", ""))
    ip, ua = get_client_info(request)
    await log_audit(
        "recurring_invoice_generated",
        user_id=user_id,
        email=user_email,
        ip=ip,
        user_agent=ua,
        details={
            "invoice_id": new_invoice["invoice_id"],
            "target": new_invoice["invoice_number"],
            "company": new_invoice.get("client_name"),
            "status": "generated",
            "owner_user_email": user_email,
        },
    )
    return {
        "ok": True,
        "invoice": _invoice_public_payload({**new_invoice, "payment_link_token": payment_link["token"], "payment_link_url": payment_link["public_url"], "public_pay_url": payment_link["public_url"]}, request.headers.get("origin", "")),
        "message": "Nächste Rechnung erzeugt",
    }


@router.get("/public/{scan_code}")
async def public_invoice(scan_code: str, request: Request):
    invoice = await db.invoices.find_one(
        {"$or": [{"scan_code": scan_code.upper()}, {"invoice_id": scan_code}, {"invoice_number": scan_code.upper()}]},
        {"_id": 0},
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    payment_link = await _get_payment_link_by_invoice(invoice, request.headers.get("origin", ""))
    payload = _invoice_public_payload({**invoice, "payment_link_token": payment_link["token"], "payment_link_url": payment_link["public_url"], "public_pay_url": payment_link["public_url"]}, request.headers.get("origin", ""))
    payload["payment_link"] = payment_link
    return payload


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

    now_iso = _now_iso()
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
            "created_at": now_iso,
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
            "created_at": now_iso,
        },
    ])

    await db.invoices.update_one(
        {"invoice_id": invoice.get("invoice_id")},
        {"$set": {"status": "paid", "paid_at": now_iso, "paid_by_email": user.get("email", ""), "paid_by_user_id": str(user["_id"]), "updated_at": now_iso}},
    )
    paid_invoice = dict(invoice)
    paid_invoice.update({"status": "paid", "paid_at": now_iso, "updated_at": now_iso})
    ip, ua = get_client_info(request)
    await log_audit(
        "invoice_paid",
        user_id=str(user.get("_id")),
        email=user.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={
            "invoice_id": invoice.get("invoice_id"),
            "target": invoice.get("invoice_number"),
            "company": invoice.get("client_name"),
            "status": "paid",
            "owner_user_email": invoice.get("user_email", ""),
        },
    )
    return {"ok": True, "invoice": _invoice_public_payload(paid_invoice, request.headers.get("origin", "")), "message": "Rechnung erfolgreich bezahlt"}


@router.post("/{invoice_id}/payment-link")
async def create_or_refresh_payment_link(invoice_id: str, request: Request):
    user = await get_current_user(request)
    invoice = await db.invoices.find_one({"invoice_id": invoice_id, "user_email": user.get("email", "")}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    link = await _get_payment_link_by_invoice(invoice, request.headers.get("origin", ""), force_refresh=False)
    return {"ok": True, "payment_link": link}


@router.get("/{invoice_id}/payment-pdf")
async def invoice_payment_pdf(invoice_id: str, request: Request):
    user = await get_current_user(request)
    invoice = await db.invoices.find_one({"invoice_id": invoice_id, "user_email": user.get("email", "")}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    link = await _get_payment_link_by_invoice(invoice, request.headers.get("origin", ""))
    pdf_bytes = await _create_invoice_payment_pdf(invoice, link)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={invoice.get('invoice_number', 'invoice')}-payment-link.pdf"},
    )


@public_router.get("/{token}")
async def public_payment_link_detail(token: str, request: Request):
    invoice, link = await _get_invoice_and_link_by_token(token, request.headers.get("origin", ""))
    issuer = await db.users.find_one({"email": invoice.get("user_email", "")}, {"_id": 0, "business_name": 1, "name": 1, "email": 1})
    payload = _invoice_public_payload(
        {
            **invoice,
            "payment_link_token": link.get("token"),
            "payment_link_url": link.get("public_url"),
            "public_pay_url": link.get("public_url"),
        },
        request.headers.get("origin", ""),
    )
    payload["payment_link"] = link
    payload["merchant_name"] = (issuer or {}).get("business_name") or (issuer or {}).get("name") or invoice.get("user_email", "")
    payload["available_methods"] = ["stripe", "wallet"]
    return payload


@public_router.post("/{token}/checkout")
async def public_payment_link_checkout(token: str, req: PaymentLinkCheckoutRequest, request: Request):
    invoice, link = await _get_invoice_and_link_by_token(token, request.headers.get("origin", ""))
    if invoice.get("status") == "paid":
        raise HTTPException(status_code=409, detail="Rechnung wurde bereits bezahlt")

    now_iso = _now_iso()
    amount = round(float(invoice.get("total", 0) or 0), 2)
    owner = await db.users.find_one({"email": invoice.get("user_email", "")})
    if not owner:
        raise HTTPException(status_code=404, detail="Rechnungssteller nicht gefunden")

    if req.method == "wallet":
        user = await get_current_user(request)
        payer_user_id = str(user.get("_id"))
        lock = await db.payment_links.find_one_and_update(
            {"token": token, "status": "active"},
            {"$set": {"status": "processing", "updated_at": now_iso, "processing_method": "wallet", "processing_by": payer_user_id}},
            projection={"_id": 0},
            return_document=ReturnDocument.BEFORE,
        )
        if not lock:
            current = await db.payment_links.find_one({"token": token}, {"_id": 0})
            if current and current.get("status") == "paid":
                raise HTTPException(status_code=409, detail="Rechnung wurde bereits bezahlt")
            raise HTTPException(status_code=409, detail="Zahlung wird bereits verarbeitet")

        debit = await db.users.update_one({"_id": user["_id"], "balance": {"$gte": amount}}, {"$inc": {"balance": -amount}})
        if debit.modified_count == 0:
            await db.payment_links.update_one({"token": token}, {"$set": {"status": "active", "updated_at": _now_iso()}})
            raise HTTPException(status_code=402, detail=f"Nicht genug Guthaben (benötigt: €{amount:.2f})")

        await db.users.update_one({"_id": owner["_id"]}, {"$inc": {"balance": amount}})
        tx_reference = f"INV-WALLET-{secrets.token_hex(5).upper()}"
        payment_tx_id = _make_id("ptx")
        await db.payment_transactions.insert_one({
            "payment_id": payment_tx_id,
            "session_id": None,
            "invoice_id": invoice.get("invoice_id"),
            "invoice_number": invoice.get("invoice_number"),
            "payment_link_token": token,
            "amount": amount,
            "currency": "EUR",
            "type": "invoice_wallet_payment",
            "status": "completed",
            "payment_status": "paid",
            "payer_user_id": payer_user_id,
            "payer_email": user.get("email", ""),
            "owner_user_id": invoice.get("owner_user_id", ""),
            "owner_user_email": invoice.get("user_email", ""),
            "reference": tx_reference,
            "created_at": now_iso,
            "updated_at": now_iso,
            "metadata": {"method": "wallet", "link_id": link.get("link_id")},
        })
        await db.transactions.insert_many([
            {
                "id": secrets.token_hex(8),
                "user_id": payer_user_id,
                "type": "invoice_payment",
                "amount": -amount,
                "description": f"Rechnung bezahlt {invoice.get('invoice_number')}",
                "status": "completed",
                "reference": tx_reference,
                "category": "invoice",
                "counterparty_email": invoice.get("user_email", ""),
                "created_at": now_iso,
            },
            {
                "id": secrets.token_hex(8),
                "user_id": str(owner["_id"]),
                "type": "invoice_payment_received",
                "amount": amount,
                "description": f"Rechnung bezahlt {invoice.get('invoice_number')}",
                "status": "completed",
                "reference": tx_reference,
                "category": "invoice",
                "counterparty_email": user.get("email", ""),
                "created_at": now_iso,
            },
        ])
        paid_invoice = await _mark_invoice_paid(invoice, link, now_iso, "wallet", user.get("email", ""), payer_user_id, tx_reference)
        return {
            "ok": True,
            "method": "wallet",
            "invoice": _invoice_public_payload({**paid_invoice, "payment_link_token": token, "payment_link_url": link.get("public_url"), "public_pay_url": link.get("public_url")}, request.headers.get("origin", "")),
            "message": "Rechnung erfolgreich mit Wallet bezahlt",
        }

    origin = _host_origin(request, req.origin_url)
    if not origin:
        raise HTTPException(status_code=400, detail="Origin URL fehlt")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{str(request.base_url).rstrip('/')}/api/webhook/stripe")
    success_url = f"{origin}/pay/{token}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pay/{token}?cancelled=1"
    metadata = {
        "type": "invoice_payment_link",
        "token": token,
        "invoice_id": invoice.get("invoice_id", ""),
        "invoice_number": invoice.get("invoice_number", ""),
        "link_id": link.get("link_id", ""),
        "owner_user_id": invoice.get("owner_user_id", ""),
        "owner_user_email": invoice.get("user_email", ""),
    }
    session = await stripe_checkout.create_checkout_session(
        CheckoutSessionRequest(
            amount=float(amount),
            currency="eur",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
            payment_methods=["card"],
        )
    )
    await db.payment_transactions.insert_one({
        "payment_id": _make_id("ptx"),
        "session_id": session.session_id,
        "invoice_id": invoice.get("invoice_id"),
        "invoice_number": invoice.get("invoice_number"),
        "payment_link_token": token,
        "amount": amount,
        "currency": "EUR",
        "type": "invoice_stripe_payment",
        "status": "initiated",
        "payment_status": "pending",
        "payer_user_id": None,
        "payer_email": req.payer_email or invoice.get("client_email", ""),
        "owner_user_id": invoice.get("owner_user_id", ""),
        "owner_user_email": invoice.get("user_email", ""),
        "reference": session.session_id,
        "created_at": now_iso,
        "updated_at": now_iso,
        "metadata": metadata,
    })
    await db.payment_links.update_one(
        {"token": token},
        {"$set": {"stripe_session_id": session.session_id, "last_checkout_created_at": now_iso, "updated_at": now_iso}},
    )
    return {"ok": True, "method": "stripe", "session_id": session.session_id, "checkout_url": session.url}


@public_router.get("/{token}/checkout-status/{session_id}")
async def public_payment_checkout_status(token: str, session_id: str, request: Request):
    invoice, link = await _get_invoice_and_link_by_token(token, request.headers.get("origin", ""))
    tx = await db.payment_transactions.find_one({"session_id": session_id, "payment_link_token": token}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Checkout-Session nicht gefunden")

    if invoice.get("status") == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "payment_status": "paid", "updated_at": _now_iso()}},
        )
        return {
            "status": "completed",
            "payment_status": "paid",
            "invoice": _invoice_public_payload({**invoice, "payment_link_token": token, "payment_link_url": link.get("public_url"), "public_pay_url": link.get("public_url")}, request.headers.get("origin", "")),
        }

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{str(request.base_url).rstrip('/')}/api/webhook/stripe")
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    now_iso = _now_iso()
    new_status = "completed" if checkout_status.payment_status == "paid" else checkout_status.status
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": new_status, "payment_status": checkout_status.payment_status, "updated_at": now_iso}},
    )

    if checkout_status.payment_status == "paid":
        tx_lock = await db.payment_transactions.find_one_and_update(
            {"session_id": session_id, "status": {"$nin": ["credited"]}},
            {"$set": {"status": "credited", "payment_status": "paid", "updated_at": now_iso}},
            projection={"_id": 0},
            return_document=ReturnDocument.BEFORE,
        )
        if tx_lock:
            owner = await db.users.find_one({"email": invoice.get("user_email", "")})
            if owner and invoice.get("status") != "paid":
                link_lock = await db.payment_links.find_one_and_update(
                    {"token": token, "status": "active"},
                    {"$set": {"status": "processing", "updated_at": now_iso, "processing_method": "stripe", "processing_session_id": session_id}},
                    projection={"_id": 0},
                    return_document=ReturnDocument.BEFORE,
                )
                if link_lock:
                    await db.users.update_one({"_id": owner["_id"]}, {"$inc": {"balance": amount if (amount := round(float(invoice.get('total', 0) or 0), 2)) else 0}})
                    reference = f"INV-STRIPE-{session_id[:12].upper()}"
                    await db.transactions.insert_one({
                        "id": secrets.token_hex(8),
                        "user_id": str(owner["_id"]),
                        "type": "invoice_payment_received",
                        "amount": amount,
                        "description": f"Öffentliche Rechnung bezahlt {invoice.get('invoice_number')}",
                        "status": "completed",
                        "reference": reference,
                        "category": "invoice",
                        "counterparty_email": tx_lock.get("payer_email", ""),
                        "created_at": now_iso,
                    })
                    invoice = await _mark_invoice_paid(invoice, link, now_iso, "stripe", tx_lock.get("payer_email", ""), "", reference)
                    await db.payment_transactions.update_one(
                        {"session_id": session_id},
                        {"$set": {"reference": reference, "credited_to_user_id": str(owner["_id"]), "updated_at": now_iso}},
                    )

    refreshed_invoice = await db.invoices.find_one({"invoice_id": invoice.get("invoice_id")}, {"_id": 0}) or invoice
    return {
        "status": new_status,
        "payment_status": checkout_status.payment_status,
        "invoice": _invoice_public_payload({**refreshed_invoice, "payment_link_token": token, "payment_link_url": link.get("public_url"), "public_pay_url": link.get("public_url")}, request.headers.get("origin", "")),
    }


@webhook_router.post("/api/webhook/stripe")
async def invoice_payment_webhook(request: Request):
    body = await request.body()
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{str(request.base_url).rstrip('/')}/api/webhook/stripe")
    try:
        event = await stripe_checkout.handle_webhook(body, request.headers.get("Stripe-Signature"))
    except Exception:
        return {"received": True, "processed": False}

    if event.payment_status == "paid" and event.session_id:
        try:
            from routes.dating import handle_dating_premium_webhook
            await handle_dating_premium_webhook(event.session_id)
        except Exception:
            pass

    metadata = dict(event.metadata or {})
    if metadata.get("type") != "invoice_payment_link":
        return {"received": True, "processed": False}

    token = metadata.get("token", "")
    session_id = event.session_id or ""
    if token and session_id and event.payment_status == "paid":
        try:
            await public_payment_checkout_status(token, session_id, request)
        except Exception:
            pass
    return {"received": True, "processed": True}
