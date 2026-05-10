"""
PDF receipt generator for EV charging sessions.
Pure-server-side, no external service. Uses reportlab.
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import Any, Dict

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)


def _fmt_dt(value: Any) -> str:
    if not value:
        return "—"
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return d.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return str(value)[:19]


def _fmt_eur(value: Any) -> str:
    try:
        return f"€{float(value):.2f}"
    except Exception:
        return "—"


def render_receipt(receipt: Dict[str, Any], session: Dict[str, Any],
                   station: Dict[str, Any], user: Dict[str, Any]) -> bytes:
    """Return raw PDF bytes for the given receipt payload."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"BidBlitz EV Receipt {receipt.get('receipt_no')}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Heading1"],
                                 fontSize=20, leading=24, textColor=colors.HexColor("#0A0A0F"))
    h2 = ParagraphStyle("H2", parent=styles["Heading3"], fontSize=11,
                        textColor=colors.HexColor("#00A0CF"), spaceAfter=4)
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=9.5, leading=13)
    small = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=8,
                           textColor=colors.HexColor("#666666"))

    story = []
    story.append(Paragraph("BidBlitz — Charging Receipt", title_style))
    story.append(Paragraph(f"Quittung Nr. {receipt.get('receipt_no')}", body))
    story.append(Paragraph(f"Ausgestellt: {_fmt_dt(receipt.get('issued_at'))}", small))
    story.append(Spacer(1, 8 * mm))

    # Two-column header: customer | station
    cust_lines = [
        Paragraph("<b>KUNDE</b>", h2),
        Paragraph(user.get("name") or user.get("email") or "—", body),
        Paragraph(user.get("email") or "", small),
        Paragraph(f"User-Nr.: {user.get('user_number') or '—'}", small),
    ]
    stn_lines = [
        Paragraph("<b>LADESTATION</b>", h2),
        Paragraph(station.get("name") or station.get("charge_point_id") or "—", body),
        Paragraph(((station.get("location") or {}).get("address") or ""), small),
        Paragraph(f"CP-ID: {station.get('charge_point_id')}", small),
        Paragraph(f"Stecker: {session.get('connector_id')}", small),
    ]
    cust_stack = Table([[c] for c in cust_lines])
    stn_stack = Table([[s] for s in stn_lines])
    header = Table([[cust_stack, stn_stack]], colWidths=[88 * mm, 88 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header)
    story.append(Spacer(1, 8 * mm))

    # Session details
    started = _fmt_dt(session.get("started_at"))
    stopped = _fmt_dt(session.get("stopped_at") or session.get("settled_at"))
    duration = f"{int(session.get('duration_min') or 0)} min"
    kwh = session.get("kwh_charged") or 0
    story.append(Paragraph("<b>FAHRTDATEN</b>", h2))
    detail = Table([
        ["Beginn", started, "Ende", stopped],
        ["Dauer", duration, "Energie", f"{float(kwh):.3f} kWh"],
        ["OCPP-TX", str(session.get("ocpp_transaction_id") or "—"),
         "Session-ID", session.get("session_id") or "—"],
    ], colWidths=[28 * mm, 60 * mm, 28 * mm, 60 * mm])
    detail.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#222222")),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#EEEEEE")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(detail)
    story.append(Spacer(1, 8 * mm))

    # Pricing breakdown
    tariff = session.get("tariff") or {}
    items = receipt.get("line_items") or []
    table_rows = [["Position", "Berechnung", "Betrag"]]
    for it in items:
        table_rows.append([it.get("label", ""), it.get("calc", ""), _fmt_eur(it.get("amount"))])
    net = float(receipt.get("net_amount", 0))
    vat = float(receipt.get("vat_amount", 0))
    total = float(receipt.get("total_amount", 0))
    table_rows.append(["", "Netto", _fmt_eur(net)])
    table_rows.append(["", f"MwSt. {receipt.get('vat_rate', 0)}%", _fmt_eur(vat)])
    table_rows.append(["", "GESAMT", _fmt_eur(total)])

    pricing = Table(table_rows, colWidths=[60 * mm, 70 * mm, 46 * mm])
    pricing.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0A0A0F")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#EEEEEE")),
        ("FONTNAME", (-1, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTNAME", (-2, -1), (-2, -1), "Helvetica-Bold"),
        ("BACKGROUND", (-2, -1), (-1, -1), colors.HexColor("#F1F8FB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(pricing)
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        f"Bezahlt via BidBlitz Wallet — Transaktion <b>{receipt.get('settlement_ref') or session.get('settlement_ref') or '—'}</b>",
        body,
    ))

    story.append(Spacer(1, 14 * mm))
    story.append(Paragraph(
        "BidBlitz operates the software, payment processing, and reconciliation for this charging "
        "session. Hardware operated by the listed station operator. Tariff includes platform fee.",
        small,
    ))
    story.append(Paragraph(
        "BidBlitz Super App · bidblitz.ae · Diese Quittung wurde maschinell erstellt und ist ohne Unterschrift gültig.",
        small,
    ))

    doc.build(story)
    return buf.getvalue()
