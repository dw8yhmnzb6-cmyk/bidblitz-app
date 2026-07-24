"""
BidBlitz Taxi — PDF Receipt (iter123 P0-3)
=============================================
Generiert eine MwSt-konforme PDF-Rechnung für eine abgeschlossene Fahrt.
Output: application/pdf via reportlab. Inhalte: Firmenkopf, Rechnungs-Nr,
Datum, Fahrt-Details (Pickup, Dropoff, Distanz, Dauer), Aufstellung Netto/USt/Brutto,
Trinkgeld separat (kein USt), optional VAT-ID des Bestellers.
"""
from __future__ import annotations
import io
from datetime import datetime, timezone
from typing import Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


VAT_RATE = 0.07  # DE Personenbeförderung 7% USt


def generate_receipt_pdf(ride: dict, user: Optional[dict] = None,
                         corporate_account: Optional[dict] = None) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    W, H = A4

    # Header
    c.setFont("Helvetica-Bold", 18)
    c.drawString(20 * mm, H - 25 * mm, "BidBlitz Taxi")
    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, H - 32 * mm, "BidBlitz Mobility GmbH · Friedrichstr. 1 · 10117 Berlin")
    c.drawString(20 * mm, H - 37 * mm, "USt-IdNr: DE000000000 · taxi@bidblitz.com")

    # Receipt title + number
    ride_id = ride.get("ride_id", "—")
    completed_at = ride.get("completed_at") or ride.get("created_at") or datetime.now(timezone.utc).isoformat()
    try:
        dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        date_str = dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        date_str = completed_at
    c.setFont("Helvetica-Bold", 14)
    c.drawString(20 * mm, H - 50 * mm, f"Quittung Nr. {ride_id[:8].upper()}")
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, H - 56 * mm, f"Datum: {date_str}")

    # Customer block
    y = H - 72 * mm
    if corporate_account:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(20 * mm, y, "Rechnungsempfänger:")
        c.setFont("Helvetica", 10)
        y -= 5 * mm
        c.drawString(20 * mm, y, corporate_account.get("company_name", ""))
        if corporate_account.get("billing_address"):
            y -= 5 * mm
            c.drawString(20 * mm, y, corporate_account["billing_address"][:80])
        if corporate_account.get("vat_id"):
            y -= 5 * mm
            c.drawString(20 * mm, y, f"USt-IdNr: {corporate_account['vat_id']}")
    elif user:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(20 * mm, y, "Kunde:")
        c.setFont("Helvetica", 10)
        y -= 5 * mm
        name = user.get("name") or user.get("email") or "—"
        c.drawString(20 * mm, y, str(name))

    # Trip details
    y -= 12 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, "Fahrt-Details")
    c.setFont("Helvetica", 10)
    y -= 6 * mm
    pickup = (ride.get("pickup") or {}).get("address") or "—"
    dropoff = (ride.get("dropoff") or {}).get("address") or "—"
    c.drawString(20 * mm, y, f"Abholung: {pickup[:80]}")
    y -= 5 * mm
    c.drawString(20 * mm, y, f"Ziel:       {dropoff[:80]}")
    y -= 5 * mm
    if ride.get("distance_km") is not None:
        c.drawString(20 * mm, y, f"Distanz:    {ride['distance_km']:.2f} km")
        y -= 5 * mm
    if ride.get("duration_min") is not None:
        c.drawString(20 * mm, y, f"Dauer:      {ride['duration_min']} Min")
        y -= 5 * mm
    if ride.get("vehicle_type"):
        c.drawString(20 * mm, y, f"Fahrzeug:   {ride['vehicle_type'].title()}")
        y -= 5 * mm

    # Cost breakdown
    fare = float(ride.get("final_fare") or ride.get("fare") or 0)
    tip = float(ride.get("tip") or 0)
    net = round(fare / (1 + VAT_RATE), 2)
    vat = round(fare - net, 2)

    y -= 8 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, "Kosten")
    c.setFont("Helvetica", 10)
    y -= 6 * mm

    def row(label, amount):
        nonlocal y
        c.drawString(20 * mm, y, label)
        c.drawRightString(W - 20 * mm, y, f"{amount:.2f} €")
        y -= 5 * mm

    row("Fahrpreis netto", net)
    row(f"USt {int(VAT_RATE * 100)}%", vat)
    c.setFont("Helvetica-Bold", 10)
    row("Fahrpreis brutto", fare)
    c.setFont("Helvetica", 10)
    if tip > 0:
        row("Trinkgeld (USt-frei)", tip)
    c.setFont("Helvetica-Bold", 11)
    row("Gesamtbetrag", fare + tip)

    # Footer
    c.setFont("Helvetica", 8)
    c.drawString(20 * mm, 20 * mm,
                 "BidBlitz Mobility GmbH · Geschäftsführer: Max Mustermann · Amtsgericht Berlin HRB 000000")
    c.drawString(20 * mm, 15 * mm,
                 "IBAN: DE00 0000 0000 0000 0000 00 · BIC: BIDBLITZXXX")

    c.showPage()
    c.save()
    return buf.getvalue()
