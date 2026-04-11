"""
BidBlitz V2 - Car Rental PDF Generator
Generates professional PDF invoices and receipts.
"""

from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from datetime import datetime


def _fmt_date(d):
    if not d:
        return ""
    try:
        dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y")
    except Exception:
        return str(d)[:10]


def _fmt_eur(amount):
    if amount is None:
        return "€0,00"
    return f"€{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="InvTitle", fontSize=20, leading=24,
        textColor=colors.HexColor("#00C2FF"), fontName="Helvetica-Bold"
    ))
    styles.add(ParagraphStyle(
        name="InvSubtitle", fontSize=10, leading=14,
        textColor=colors.HexColor("#666666")
    ))
    styles.add(ParagraphStyle(
        name="InvHeader", fontSize=12, leading=16,
        fontName="Helvetica-Bold", textColor=colors.HexColor("#222222")
    ))
    styles.add(ParagraphStyle(
        name="InvBody", fontSize=10, leading=14,
        textColor=colors.HexColor("#333333")
    ))
    styles.add(ParagraphStyle(
        name="InvSmall", fontSize=8, leading=11,
        textColor=colors.HexColor("#888888")
    ))
    styles.add(ParagraphStyle(
        name="InvRight", fontSize=10, leading=14,
        textColor=colors.HexColor("#333333"), alignment=TA_RIGHT
    ))
    return styles


def generate_invoice_pdf(invoice: dict, booking: dict = None, vendor: dict = None) -> bytes:
    """Generate invoice PDF."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    styles = _styles()
    elements = []
    
    # Header
    elements.append(Paragraph("RECHNUNG", styles["InvTitle"]))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(
        f"Rechnungsnr.: {invoice.get('invoice_number', invoice.get('invoice_id', 'N/A'))}",
        styles["InvBody"]
    ))
    elements.append(Paragraph(f"Datum: {_fmt_date(invoice.get('created_at'))}", styles["InvSubtitle"]))
    elements.append(Spacer(1, 8*mm))
    
    # Vendor info
    if vendor:
        company = vendor.get("company", {})
        elements.append(Paragraph("Vermieter:", styles["InvSmall"]))
        elements.append(Paragraph(company.get("company_name", ""), styles["InvHeader"]))
        addr = f"{company.get('address', '')}, {company.get('postal_code', '')} {company.get('city', '')}"
        elements.append(Paragraph(addr, styles["InvBody"]))
        if company.get("tax_id"):
            elements.append(Paragraph(f"USt-IdNr.: {company['tax_id']}", styles["InvSmall"]))
        elements.append(Spacer(1, 5*mm))
    
    # Customer info
    if booking:
        elements.append(Paragraph("Kunde:", styles["InvSmall"]))
        elements.append(Paragraph(booking.get("customer_name", ""), styles["InvHeader"]))
        elements.append(Paragraph(booking.get("customer_email", ""), styles["InvBody"]))
        elements.append(Spacer(1, 5*mm))
    
    # Booking details
    if booking:
        elements.append(Paragraph("Buchungsdetails", styles["InvHeader"]))
        elements.append(Spacer(1, 2*mm))
        
        details = [
            ["Fahrzeug:", booking.get("car_title", "")],
            ["Zeitraum:", f"{_fmt_date(booking.get('start_date'))} - {_fmt_date(booking.get('end_date'))}"],
            ["Miettage:", str(booking.get("rental_days", ""))],
        ]
        
        t = Table(details, colWidths=[40*mm, 120*mm])
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
            ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#222222")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 6*mm))
    
    # Line items
    elements.append(Paragraph("Positionen", styles["InvHeader"]))
    elements.append(Spacer(1, 2*mm))
    
    line_items = invoice.get("line_items", [])
    if not line_items and booking:
        line_items = [
            {"description": f"Fahrzeugmiete ({booking.get('rental_days', 0)} Tage)", "amount": booking.get("rental_amount", 0)},
        ]
        if booking.get("extras_amount", 0) > 0:
            line_items.append({"description": "Zusatzoptionen", "amount": booking["extras_amount"]})
        line_items.append({"description": "MwSt. (19%)", "amount": booking.get("tax_amount", 0)})
        if booking.get("deposit_amount", 0) > 0:
            line_items.append({"description": "Kaution (rückerstattbar)", "amount": booking["deposit_amount"]})
    
    data = [["Beschreibung", "Betrag"]]
    for item in line_items:
        data.append([
            item.get("description", ""),
            _fmt_eur(item.get("amount", 0))
        ])
    
    # Total
    total = invoice.get("total", 0)
    if not total and booking:
        total = booking.get("total_amount", 0)
    
    data.append(["", ""])
    data.append(["Gesamtbetrag", _fmt_eur(total)])
    
    t = Table(data, colWidths=[120*mm, 40*mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F0F0F0")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#CCCCCC")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("TEXTCOLOR", (1, -1), (1, -1), colors.HexColor("#00C2FF")),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#222222")),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 10*mm))
    
    # Footer
    elements.append(Paragraph(
        f"Status: {invoice.get('status', 'draft').upper()}",
        styles["InvBody"]
    ))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(
        "Erstellt via BidBlitz V2 Car Rental Platform",
        styles["InvSmall"]
    ))
    
    doc.build(elements)
    return buf.getvalue()


def generate_receipt_pdf(booking: dict, vendor: dict = None) -> bytes:
    """Generate booking receipt PDF."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    styles = _styles()
    elements = []
    
    # Header
    elements.append(Paragraph("BUCHUNGSBELEG", styles["InvTitle"]))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(f"Buchungsnr.: {booking.get('booking_id', 'N/A')}", styles["InvBody"]))
    elements.append(Paragraph(f"Datum: {_fmt_date(booking.get('created_at'))}", styles["InvSubtitle"]))
    elements.append(Paragraph(f"Status: {booking.get('status', '').upper()}", styles["InvBody"]))
    elements.append(Spacer(1, 8*mm))
    
    # Vendor
    if vendor:
        company = vendor.get("company", {})
        elements.append(Paragraph("Vermieter:", styles["InvSmall"]))
        elements.append(Paragraph(company.get("company_name", ""), styles["InvHeader"]))
        elements.append(Paragraph(
            f"{company.get('address', '')}, {company.get('postal_code', '')} {company.get('city', '')}",
            styles["InvBody"]
        ))
        elements.append(Spacer(1, 5*mm))
    
    # Customer
    elements.append(Paragraph("Kunde:", styles["InvSmall"]))
    elements.append(Paragraph(booking.get("customer_name", ""), styles["InvHeader"]))
    elements.append(Paragraph(booking.get("customer_email", ""), styles["InvBody"]))
    elements.append(Spacer(1, 6*mm))
    
    # Car & booking details
    elements.append(Paragraph("Buchungsdetails", styles["InvHeader"]))
    elements.append(Spacer(1, 2*mm))
    
    details = [
        ["Fahrzeug:", f"{booking.get('car_title', '')} ({booking.get('car_brand', '')} {booking.get('car_model', '')})"],
        ["Zeitraum:", f"{_fmt_date(booking.get('start_date'))} - {_fmt_date(booking.get('end_date'))}"],
        ["Miettage:", str(booking.get("rental_days", ""))],
        ["Abholung:", booking.get("pickup_time", "10:00") + " Uhr"],
        ["Rückgabe:", booking.get("return_time", "10:00") + " Uhr"],
    ]
    
    t = Table(details, colWidths=[40*mm, 120*mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 6*mm))
    
    # Pricing
    elements.append(Paragraph("Kostenaufstellung", styles["InvHeader"]))
    elements.append(Spacer(1, 2*mm))
    
    data = [["Position", "Betrag"]]
    data.append([f"Fahrzeugmiete ({booking.get('rental_days', 0)} Tage)", _fmt_eur(booking.get("rental_amount", 0))])
    if booking.get("extras_amount", 0) > 0:
        data.append(["Zusatzoptionen", _fmt_eur(booking["extras_amount"])])
    data.append(["MwSt. (19%)", _fmt_eur(booking.get("tax_amount", 0))])
    if booking.get("deposit_amount", 0) > 0:
        data.append(["Kaution (rückerstattbar)", _fmt_eur(booking["deposit_amount"])])
    data.append(["", ""])
    data.append(["Gesamtbetrag", _fmt_eur(booking.get("total_amount", 0))])
    
    t = Table(data, colWidths=[120*mm, 40*mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F0F0F0")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#CCCCCC")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("TEXTCOLOR", (1, -1), (1, -1), colors.HexColor("#00C2FF")),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#222222")),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 10*mm))
    
    # Payment info
    elements.append(Paragraph(
        f"Bezahlt via BidBlitz Wallet · {_fmt_date(booking.get('paid_at', booking.get('created_at')))}",
        styles["InvSmall"]
    ))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph("Erstellt via BidBlitz V2 Car Rental Platform", styles["InvSmall"]))
    
    doc.build(elements)
    return buf.getvalue()


def generate_contract_pdf(contract: dict, booking: dict = None, vendor: dict = None) -> bytes:
    """Generate contract PDF from contract data."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    styles = _styles()
    elements = []

    elements.append(Paragraph("MIETVERTRAG", styles["InvTitle"]))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(f"Vertrag-Nr.: {contract.get('contract_id', 'N/A')}", styles["InvBody"]))
    elements.append(Paragraph(f"Datum: {_fmt_date(contract.get('created_at'))}", styles["InvSubtitle"]))
    elements.append(Spacer(1, 8*mm))

    # Parties
    elements.append(Paragraph("1. Vertragsparteien", styles["InvHeader"]))
    elements.append(Spacer(1, 2*mm))
    if vendor:
        company = vendor.get("company", {})
        elements.append(Paragraph(f"Vermieter: {company.get('company_name', '')}", styles["InvBody"]))
        elements.append(Paragraph(f"{company.get('address', '')}, {company.get('postal_code', '')} {company.get('city', '')}", styles["InvSmall"]))
    if booking:
        elements.append(Spacer(1, 2*mm))
        elements.append(Paragraph(f"Mieter: {booking.get('customer_name', '')}", styles["InvBody"]))
        elements.append(Paragraph(f"E-Mail: {booking.get('customer_email', '')}", styles["InvSmall"]))
    elements.append(Spacer(1, 5*mm))

    # Vehicle
    elements.append(Paragraph("2. Mietgegenstand", styles["InvHeader"]))
    elements.append(Spacer(1, 2*mm))
    if booking:
        v_info = [
            ["Fahrzeug:", f"{booking.get('car_title', '')} ({booking.get('car_brand', '')} {booking.get('car_model', '')})"],
            ["Kennzeichen:", contract.get("vehicle", {}).get("registration_number", booking.get("registration_number", ""))],
        ]
        t = Table(v_info, colWidths=[40*mm, 120*mm])
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)
    elements.append(Spacer(1, 5*mm))

    # Rental period
    elements.append(Paragraph("3. Mietdauer & Kosten", styles["InvHeader"]))
    elements.append(Spacer(1, 2*mm))
    if booking:
        details = [
            ["Zeitraum:", f"{_fmt_date(booking.get('start_date'))} - {_fmt_date(booking.get('end_date'))}"],
            ["Miettage:", str(booking.get("rental_days", ""))],
            ["Mietpreis:", _fmt_eur(booking.get("rental_amount", 0))],
            ["MwSt.:", _fmt_eur(booking.get("tax_amount", 0))],
            ["Kaution:", _fmt_eur(booking.get("deposit_amount", 0))],
            ["Gesamtbetrag:", _fmt_eur(booking.get("total_amount", 0))],
        ]
        t = Table(details, colWidths=[40*mm, 120*mm])
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("TEXTCOLOR", (1, -1), (1, -1), colors.HexColor("#00C2FF")),
        ]))
        elements.append(t)
    elements.append(Spacer(1, 5*mm))

    # Terms
    terms = contract.get("terms", "")
    if terms:
        elements.append(Paragraph("4. Allgemeine Bedingungen", styles["InvHeader"]))
        elements.append(Spacer(1, 2*mm))
        for line in terms.split("\n")[:20]:
            if line.strip():
                elements.append(Paragraph(line.strip(), styles["InvSmall"]))
        elements.append(Spacer(1, 5*mm))

    # Signatures
    elements.append(Paragraph("Unterschriften", styles["InvHeader"]))
    elements.append(Spacer(1, 3*mm))
    sig_data = [
        ["Vermieter", "Mieter"],
        [
            contract.get("vendor_signature", "___________________") if contract.get("signed_vendor") else "___________________",
            contract.get("customer_signature", "___________________") if contract.get("signed_customer") else "___________________",
        ],
        [
            _fmt_date(contract.get("vendor_signed_at", "")) if contract.get("signed_vendor") else "Datum: ___________",
            _fmt_date(contract.get("customer_signed_at", "")) if contract.get("signed_customer") else "Datum: ___________",
        ],
    ]
    t = Table(sig_data, colWidths=[80*mm, 80*mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, colors.HexColor("#333333")),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 10*mm))

    elements.append(Paragraph("Erstellt via BidBlitz V2 Car Rental Platform", styles["InvSmall"]))

    doc.build(elements)
    return buf.getvalue()
