"""
Business CSV Export + Invoice PDF Generation + Download
"""
import os
import io
import csv
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, Response
from fastapi.responses import FileResponse

from dependencies import get_current_user
from config import db

router = APIRouter(prefix="/business", tags=["Business Export & Invoices"])

UTC = timezone.utc
INVOICE_DIR = "/var/www/bidblitz/backend/storage/invoices"
LOGO_PATH = "/var/www/bidblitz/backend/assets/bidblitz-logo.png"


async def require_member(business_id, user_id):
    m = await db.business_members.find_one({"business_id": business_id, "user_id": user_id, "status": "active"})
    if not m:
        raise HTTPException(403, "NOT_BUSINESS_MEMBER")
    return m


# ==================== CSV EXPORT ====================

@router.get("/dashboard/export.csv")
async def export_csv(business_id: str = Query(...), user: dict = Depends(get_current_user)):
    await require_member(business_id, user["id"])

    now = datetime.now(UTC)
    start = (now - timedelta(days=30)).isoformat()

    cursor = db.business_ledger.find(
        {"business_id": business_id, "created_at": {"$gte": start}},
        {"_id": 0}
    ).sort("created_at", -1)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Datum", "Modul", "Beschreibung", "Mitarbeiter", "Betrag EUR"])

    async for t in cursor:
        writer.writerow([
            t.get("created_at", "")[:19],
            t.get("source_module", "other"),
            t.get("description", ""),
            t.get("user_id", "")[:8],
            f"{int(t.get('amount_cents', 0)) / 100:.2f}"
        ])

    return Response(
        content=output.getvalue().encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="bidblitz_business_{business_id}_30d.csv"'}
    )


# ==================== INVOICE PDF ====================

@router.post("/invoices/latest/pdf/generate")
async def generate_invoice_pdf(business_id: str = Query(...), user: dict = Depends(get_current_user)):
    m = await require_member(business_id, user["id"])
    if m.get("role") != "business_admin":
        raise HTTPException(403, "NOT_BUSINESS_ADMIN")

    business = await db.business_accounts.find_one({"business_id": business_id})
    if not business:
        raise HTTPException(404, "BUSINESS_NOT_FOUND")

    # Get or create invoice for current month
    now = datetime.now(UTC)
    inv = await db.business_invoices.find_one({"business_id": business_id})

    if not inv:
        # Create invoice from ledger data
        month_start = datetime(now.year, now.month, 1, tzinfo=UTC).isoformat()
        txns = await db.business_ledger.find({"business_id": business_id, "created_at": {"$gte": month_start}}, {"_id": 0}).to_list(500)
        total = sum(int(t.get("amount_cents", 0)) for t in txns)

        inv = {
            "invoice_id": f"INV-{business_id}-{now.strftime('%Y%m')}",
            "business_id": business_id,
            "period_year": now.year,
            "period_month": now.month,
            "status": "draft",
            "total_cents": total,
            "line_items": [{"description": t.get("description", ""), "amount_cents": t.get("amount_cents", 0)} for t in txns],
            "issued_at": now,
            "due_at": now + timedelta(days=14)
        }
        await db.business_invoices.insert_one(inv)

    # Generate PDF
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas as pdf_canvas
    except ImportError:
        raise HTTPException(500, "reportlab nicht installiert. pip install reportlab")

    out_dir = os.path.join(INVOICE_DIR, business_id)
    os.makedirs(out_dir, exist_ok=True)
    invoice_id = inv.get("invoice_id", "invoice")
    file_path = os.path.join(out_dir, f"{invoice_id}.pdf")

    c = pdf_canvas.Canvas(file_path, pagesize=A4)
    w, h = A4

    # Logo
    if os.path.exists(LOGO_PATH):
        try:
            from reportlab.lib.utils import ImageReader
            c.drawImage(ImageReader(LOGO_PATH), 40, h - 80, width=120, height=40, mask="auto")
            c.setFont("Helvetica-Bold", 16)
            c.drawString(170, h - 60, "BidBlitz Pay")
            c.setFont("Helvetica", 10)
            c.drawString(170, h - 78, "Business Invoice")
        except:
            c.setFont("Helvetica-Bold", 18)
            c.drawString(40, h - 60, "BidBlitz Pay")
    else:
        c.setFont("Helvetica-Bold", 18)
        c.drawString(40, h - 60, "BidBlitz Pay")
        c.setFont("Helvetica", 10)
        c.drawString(40, h - 78, "Business Invoice")

    # Invoice meta
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(w - 40, h - 60, f"Invoice: {invoice_id}")
    c.setFont("Helvetica", 10)
    issued = inv.get("issued_at")
    due = inv.get("due_at")
    c.drawRightString(w - 40, h - 76, f"Issued: {issued.strftime('%Y-%m-%d') if hasattr(issued, 'strftime') else str(issued)[:10]}")
    c.drawRightString(w - 40, h - 90, f"Due: {due.strftime('%Y-%m-%d') if hasattr(due, 'strftime') else str(due)[:10]}")
    c.drawRightString(w - 40, h - 104, f"Status: {inv.get('status', '')}")

    # Business info
    y = h - 140
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Billed To:")
    c.setFont("Helvetica", 10)
    c.drawString(40, y - 16, business.get("name", ""))
    c.drawString(40, y - 32, business.get("billing_email", ""))
    c.drawString(40, y - 48, f"Tax ID: {business.get('tax_id', '-')}")
    c.drawString(40, y - 72, f"Period: {inv.get('period_year', '')}-{str(inv.get('period_month', '')).zfill(2)}")

    # Table
    ty = y - 100
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, ty, "Description")
    c.drawRightString(w - 40, ty, "Amount")
    c.line(40, ty - 4, w - 40, ty - 4)

    cy = ty - 22
    c.setFont("Helvetica", 9)
    for it in inv.get("line_items", []):
        desc = str(it.get("description", ""))[:80]
        amt = int(it.get("amount_cents", 0))
        c.drawString(40, cy, desc)
        c.drawRightString(w - 40, cy, f"{amt / 100:.2f} EUR")
        cy -= 14
        if cy < 100:
            c.showPage()
            cy = h - 60
            c.setFont("Helvetica", 9)

    # Total
    total = int(inv.get("total_cents", 0))
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(w - 40, 90, f"TOTAL: {total / 100:.2f} EUR")

    c.setFont("Helvetica", 8)
    c.drawString(40, 60, "Payment: BidBlitz Pay Business Wallet")
    c.drawString(40, 48, "Support: partner@bidblitz.ae")
    c.save()

    # Save meta
    sha = hashlib.sha256(open(file_path, "rb").read()).hexdigest()
    await db.business_invoices.update_one(
        {"invoice_id": invoice_id},
        {"$set": {"pdf": {"file_path": file_path, "sha256": sha, "size": os.path.getsize(file_path), "generated_at": now.isoformat()}}}
    )

    return {"ok": True, "invoice_id": invoice_id, "file_path": file_path}


@router.get("/invoices/latest/pdf")
async def download_invoice_pdf(business_id: str = Query(...), user: dict = Depends(get_current_user)):
    m = await require_member(business_id, user["id"])
    if m.get("role") != "business_admin":
        raise HTTPException(403, "NOT_BUSINESS_ADMIN")

    inv = await db.business_invoices.find_one({"business_id": business_id, "pdf.file_path": {"$exists": True}})
    if not inv:
        raise HTTPException(404, "Keine PDF gefunden. Bitte erst generieren.")

    fp = inv["pdf"]["file_path"]
    if not os.path.exists(fp):
        raise HTTPException(404, "PDF Datei fehlt")

    return FileResponse(fp, media_type="application/pdf", filename=f"BidBlitz_Invoice_{inv['invoice_id']}.pdf")
