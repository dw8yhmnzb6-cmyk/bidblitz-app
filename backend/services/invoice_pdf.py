"""
Invoice PDF Generator - Professional layout with logo, table, total box
Adapted for BidBlitz: Motor async, paths for IONOS server
"""
import os
import hashlib
from datetime import datetime, timezone
from fastapi import HTTPException
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

UTC = timezone.utc
LOGO_PATH = os.getenv("BIDBLITZ_LOGO_PATH", "/var/www/bidblitz/backend/assets/bidblitz-logo.png")
INVOICE_DIR = os.getenv("INVOICE_PDF_DIR", "/var/www/bidblitz/backend/storage/invoices")

def _utcnow(): return datetime.now(UTC)
def _eur(cents): return f"{cents/100:.2f} EUR"
def _safe(s): return (s or "").strip()
def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""): h.update(chunk)
    return h.hexdigest()

def _status_label(s):
    s = (s or "").lower()
    return {"paid":"PAID","overdue":"OVERDUE","issued":"ISSUED","draft":"DRAFT"}.get(s, s.upper() or "—")


async def generate_latest_invoice_pdf(db, business_id, base_dir=None):
    base_dir = base_dir or INVOICE_DIR

    inv_list = await db.business_invoices.find({"business_id": business_id}).sort("issued_at", -1).to_list(1)
    if not inv_list:
        raise HTTPException(404, "NO_INVOICE_FOUND")
    inv = inv_list[0]
    invoice_id = inv.get("invoice_id")
    if not invoice_id:
        raise HTTPException(400, "INVOICE_ID_MISSING")

    business = await db.business_accounts.find_one({"business_id": business_id})
    if not business:
        raise HTTPException(404, "BUSINESS_NOT_FOUND")

    out_dir = os.path.join(base_dir, business_id)
    os.makedirs(out_dir, exist_ok=True)
    file_path = os.path.join(out_dir, f"{invoice_id}.pdf")

    c = canvas.Canvas(file_path, pagesize=A4)
    w, h = A4
    left, right, top, bottom = 40, w - 40, h - 40, 40

    def draw_header():
        if os.path.exists(LOGO_PATH):
            try:
                c.drawImage(ImageReader(LOGO_PATH), left, top - 55, width=120, height=40, mask="auto")
                c.setFont("Helvetica-Bold", 16); c.drawString(left + 135, top - 28, "BidBlitz Pay")
                c.setFont("Helvetica", 10); c.drawString(left + 135, top - 44, "Business Invoice")
            except:
                c.setFont("Helvetica-Bold", 18); c.drawString(left, top - 28, "BidBlitz Pay")
                c.setFont("Helvetica", 10); c.drawString(left, top - 44, "Business Invoice")
        else:
            c.setFont("Helvetica-Bold", 18); c.drawString(left, top - 28, "BidBlitz Pay")
            c.setFont("Helvetica", 10); c.drawString(left, top - 44, "Business Invoice")

        c.setFont("Helvetica-Bold", 11); c.drawRightString(right, top - 24, f"Invoice: {invoice_id}")
        issued = inv.get("issued_at"); due = inv.get("due_at"); status = _status_label(inv.get("status", ""))
        c.setFont("Helvetica", 9)
        c.drawRightString(right, top - 40, f"Issued: {issued.date().isoformat() if hasattr(issued,'date') else str(issued)[:10]}")
        c.drawRightString(right, top - 54, f"Due: {due.date().isoformat() if hasattr(due,'date') else str(due)[:10]}")
        c.drawRightString(right, top - 68, f"Status: {status}")
        c.line(left, top - 80, right, top - 80)

    def draw_billed_to(y):
        c.setFont("Helvetica-Bold", 11); c.drawString(left, y, "Billed To:")
        c.setFont("Helvetica", 10)
        name = _safe(business.get("name")); email = _safe(business.get("billing_email")); tax = _safe(business.get("tax_id"))
        ny = y - 16
        if name: c.drawString(left, ny, name); ny -= 14
        if email: c.drawString(left, ny, f"Email: {email}"); ny -= 14
        if tax: c.drawString(left, ny, f"Tax ID: {tax}"); ny -= 14
        c.drawString(left, ny, f"Period: {inv.get('period_year', '')}-{str(inv.get('period_month', '')).zfill(2)}")
        return ny - 26

    def draw_table_header(y):
        c.setFont("Helvetica-Bold", 10)
        c.drawString(left, y, "Description"); c.drawRightString(right - 120, y, "Qty"); c.drawRightString(right - 40, y, "Amount")
        c.line(left, y - 4, right, y - 4)
        return y - 18

    def draw_total_box(total):
        bw, bh = 220, 55; x = right - bw; y = bottom + 30
        c.rect(x, y, bw, bh, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 12); c.drawString(x + 12, y + 32, "TOTAL"); c.drawRightString(x + bw - 12, y + 32, _eur(total))
        c.setFont("Helvetica", 8); c.drawString(x + 12, y + 14, "Pay via BidBlitz Pay Business Wallet")

    def draw_footer():
        c.setFont("Helvetica", 8)
        c.drawString(left, bottom + 12, "Support: partner@bidblitz.ae")
        c.drawRightString(right, bottom + 12, "BidBlitz Pay | Pristina")

    # === RENDER ===
    draw_header()
    y = top - 110
    y = draw_billed_to(y)
    y = draw_table_header(y)

    c.setFont("Helvetica", 10)
    for it in inv.get("line_items", []):
        desc = _safe(it.get("description")) or _safe(it.get("type")) or "Item"
        qty = int(it.get("qty", 1)) if it.get("qty") is not None else 1
        amt = int(it.get("amount_cents", 0))

        if y < bottom + 110:
            draw_footer(); c.showPage(); draw_header(); y = top - 110; y = draw_table_header(y); c.setFont("Helvetica", 10)

        c.drawString(left, y, desc[:85])
        c.drawRightString(right - 120, y, str(qty))
        c.drawRightString(right - 40, y, _eur(amt))
        c.line(left, y - 4, right, y - 4)
        y -= 16

    draw_total_box(int(inv.get("total_cents", 0)))
    draw_footer()
    c.save()

    meta = {"file_path": file_path, "generated_at": _utcnow().isoformat(), "file_sha256": _sha256(file_path), "file_size_bytes": os.path.getsize(file_path)}
    await db.business_invoices.update_one({"_id": inv["_id"]}, {"$set": {"pdf": meta}})
    return {"ok": True, "invoice_id": invoice_id, "pdf": meta}
