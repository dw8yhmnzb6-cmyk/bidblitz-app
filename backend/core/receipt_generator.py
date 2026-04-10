"""
BidBlitz V2 - Receipt PDF Generation
Generates PDF receipts for transactions, payments, and merchant operations.
"""

import io
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from bson import ObjectId

from core.database import db


# ══════════════════════════════════════════════════════════════════════════════
# PDF GENERATION HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def create_receipt_styles():
    """Create custom styles for receipt PDF."""
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        name='ReceiptTitle',
        parent=styles['Heading1'],
        fontSize=20,
        alignment=TA_CENTER,
        spaceAfter=10,
        textColor=colors.HexColor('#00C2FF')
    ))
    
    styles.add(ParagraphStyle(
        name='ReceiptSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        textColor=colors.grey,
        spaceAfter=20
    ))
    
    styles.add(ParagraphStyle(
        name='SectionHeader',
        parent=styles['Heading2'],
        fontSize=12,
        spaceBefore=15,
        spaceAfter=8,
        textColor=colors.HexColor('#333333')
    ))
    
    styles.add(ParagraphStyle(
        name='Amount',
        parent=styles['Normal'],
        fontSize=24,
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=10,
        textColor=colors.HexColor('#00C2FF'),
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='Footer',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.grey,
        spaceBefore=30
    ))
    
    return styles


def format_currency(amount: float) -> str:
    """Format amount as EUR currency."""
    return f"€{abs(amount):,.2f}"


def format_datetime(dt_str: str) -> str:
    """Format datetime string for display."""
    try:
        if isinstance(dt_str, str):
            dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        else:
            dt = dt_str
        return dt.strftime("%d.%m.%Y %H:%M:%S")
    except:
        return str(dt_str)


# ══════════════════════════════════════════════════════════════════════════════
# RECEIPT GENERATORS
# ══════════════════════════════════════════════════════════════════════════════

async def generate_transaction_receipt(
    transaction_id: str,
    user_id: str
) -> Optional[bytes]:
    """
    Generate PDF receipt for a transaction.
    Returns PDF bytes or None if transaction not found.
    """
    
    # Find transaction
    transaction = await db.transactions.find_one({
        "$or": [
            {"id": transaction_id},
            {"reference": transaction_id}
        ],
        "user_id": user_id
    })
    
    if not transaction:
        return None
    
    # Get user info
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    user_name = user.get("name", "User") if user else "User"
    user_email = user.get("email", "") if user else ""
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    styles = create_receipt_styles()
    elements = []
    
    # Header
    elements.append(Paragraph("BidBlitz", styles['ReceiptTitle']))
    elements.append(Paragraph("Transaktionsbeleg", styles['ReceiptSubtitle']))
    
    # Amount
    amount = transaction.get("amount", 0)
    amount_str = format_currency(amount)
    if amount > 0:
        amount_display = f"+{amount_str}"
        color = colors.green
    else:
        amount_display = f"-{format_currency(abs(amount))}"
        color = colors.red
    
    elements.append(Paragraph(amount_display, styles['Amount']))
    
    # Transaction details table
    elements.append(Paragraph("Transaktionsdetails", styles['SectionHeader']))
    
    tx_type_labels = {
        "topup": "Aufladung",
        "stripe_topup": "Stripe Aufladung",
        "payment": "Zahlung",
        "transfer": "Überweisung",
        "transfer_out": "Gesendet",
        "transfer_in": "Empfangen",
        "refund": "Rückerstattung",
        "auction_bid": "Auktion Gebot",
        "mining_purchase": "Mining Kauf",
        "mining_reward": "Mining Belohnung",
        "kids_transfer": "Kids Transfer",
        "merchant_credit": "Händler Gutschrift",
    }
    
    tx_type = transaction.get("type", "transaction")
    tx_type_label = tx_type_labels.get(tx_type, tx_type.replace("_", " ").title())
    
    details_data = [
        ["Referenz:", transaction.get("reference", transaction.get("id", "N/A"))],
        ["Typ:", tx_type_label],
        ["Status:", transaction.get("status", "completed").upper()],
        ["Beschreibung:", transaction.get("description", "-")],
        ["Datum:", format_datetime(transaction.get("created_at", ""))],
    ]
    
    if transaction.get("merchant_name"):
        details_data.append(["Händler:", transaction.get("merchant_name")])
    
    details_table = Table(details_data, colWidths=[50*mm, 100*mm])
    details_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(details_table)
    
    # Account info
    elements.append(Spacer(1, 15*mm))
    elements.append(Paragraph("Kontoinformationen", styles['SectionHeader']))
    
    account_data = [
        ["Kontoinhaber:", user_name],
        ["E-Mail:", user_email],
    ]
    
    account_table = Table(account_data, colWidths=[50*mm, 100*mm])
    account_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(account_table)
    
    # Footer
    elements.append(Spacer(1, 20*mm))
    elements.append(Paragraph(
        f"Erstellt am {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M:%S')} UTC",
        styles['Footer']
    ))
    elements.append(Paragraph(
        "BidBlitz V2 • Ihr digitales Wallet für moderne Zahlungen",
        styles['Footer']
    ))
    elements.append(Paragraph(
        "Dies ist ein automatisch generierter Beleg.",
        styles['Footer']
    ))
    
    # Build PDF
    doc.build(elements)
    
    # Store receipt reference
    receipt_id = f"RCP-{secrets.token_hex(6).upper()}"
    await db.receipts.insert_one({
        "receipt_id": receipt_id,
        "transaction_id": transaction_id,
        "user_id": user_id,
        "type": "transaction",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    buffer.seek(0)
    return buffer.getvalue()


async def generate_merchant_receipt(
    payment_id: str,
    merchant_id: str
) -> Optional[bytes]:
    """
    Generate PDF receipt for merchant payment.
    """
    
    # Find payment
    payment = await db.merchant_transactions.find_one({
        "$or": [
            {"id": payment_id},
            {"payment_id": payment_id},
            {"reference": payment_id}
        ],
        "merchant_id": merchant_id
    })
    
    if not payment:
        # Try old transactions collection
        payment = await db.transactions.find_one({
            "$or": [
                {"id": payment_id},
                {"reference": payment_id}
            ],
            "user_id": merchant_id,
            "type": {"$in": ["merchant_credit", "payment"]}
        })
    
    if not payment:
        return None
    
    # Get merchant info
    merchant = await db.merchant_profiles.find_one({"user_id": merchant_id})
    business_name = merchant.get("business_name", "Händler") if merchant else "Händler"
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    styles = create_receipt_styles()
    elements = []
    
    # Header
    elements.append(Paragraph(business_name, styles['ReceiptTitle']))
    elements.append(Paragraph("Zahlungsbeleg", styles['ReceiptSubtitle']))
    
    # Amount
    amount = payment.get("amount", payment.get("net", 0))
    elements.append(Paragraph(format_currency(abs(amount)), styles['Amount']))
    
    # Payment details
    elements.append(Paragraph("Zahlungsdetails", styles['SectionHeader']))
    
    details_data = [
        ["Referenz:", payment.get("reference", payment.get("id", "N/A"))],
        ["Status:", payment.get("status", "completed").upper()],
        ["Zahlungsart:", payment.get("payment_method", "Wallet").title()],
        ["Datum:", format_datetime(payment.get("created_at", ""))],
    ]
    
    if payment.get("description"):
        details_data.append(["Beschreibung:", payment.get("description")])
    
    # Fee info
    if payment.get("fee"):
        details_data.append(["Bruttobetrag:", format_currency(payment.get("gross", amount))])
        details_data.append(["Gebühr:", format_currency(payment.get("fee", 0))])
        details_data.append(["Nettobetrag:", format_currency(payment.get("net", amount))])
    
    details_table = Table(details_data, colWidths=[50*mm, 100*mm])
    details_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(details_table)
    
    # Footer
    elements.append(Spacer(1, 30*mm))
    elements.append(Paragraph(
        f"Erstellt am {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M:%S')} UTC",
        styles['Footer']
    ))
    elements.append(Paragraph(
        "BidBlitz V2 • Powered by BidBlitz Payment Solutions",
        styles['Footer']
    ))
    
    doc.build(elements)
    
    # Store receipt
    receipt_id = f"MRCP-{secrets.token_hex(6).upper()}"
    await db.receipts.insert_one({
        "receipt_id": receipt_id,
        "payment_id": payment_id,
        "merchant_id": merchant_id,
        "type": "merchant",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    buffer.seek(0)
    return buffer.getvalue()


async def generate_kids_receipt(
    transaction_id: str,
    parent_id: str
) -> Optional[bytes]:
    """
    Generate PDF receipt for Kids transaction.
    """
    
    # Find transaction
    transaction = await db.kids_transactions.find_one({
        "$or": [
            {"id": transaction_id},
            {"reference": transaction_id}
        ],
        "parent_id": parent_id
    })
    
    if not transaction:
        return None
    
    # Get child info
    child = await db.kids_children.find_one({"child_id": transaction.get("child_id")})
    child_name = child.get("name", "Kind") if child else "Kind"
    
    # Get parent info
    parent = await db.users.find_one({"_id": ObjectId(parent_id)})
    parent_name = parent.get("name", "Eltern") if parent else "Eltern"
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    styles = create_receipt_styles()
    elements = []
    
    # Header
    elements.append(Paragraph("BidBlitz Kids", styles['ReceiptTitle']))
    elements.append(Paragraph("Transaktionsbeleg", styles['ReceiptSubtitle']))
    
    # Amount
    amount = transaction.get("amount", 0)
    elements.append(Paragraph(format_currency(abs(amount)), styles['Amount']))
    
    # Details
    elements.append(Paragraph("Details", styles['SectionHeader']))
    
    tx_type = transaction.get("type", "")
    type_label = {
        "allowance": "Taschengeld",
        "payment": "Zahlung",
    }.get(tx_type, tx_type.title())
    
    details_data = [
        ["Referenz:", transaction.get("reference", transaction.get("id", "N/A"))],
        ["Typ:", type_label],
        ["Kind:", child_name],
        ["Eltern:", parent_name],
        ["Beschreibung:", transaction.get("description", "-")],
        ["Datum:", format_datetime(transaction.get("created_at", ""))],
    ]
    
    if transaction.get("merchant_name"):
        details_data.append(["Händler:", transaction.get("merchant_name")])
    
    details_table = Table(details_data, colWidths=[50*mm, 100*mm])
    details_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(details_table)
    
    # Footer
    elements.append(Spacer(1, 30*mm))
    elements.append(Paragraph(
        f"Erstellt am {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M:%S')} UTC",
        styles['Footer']
    ))
    elements.append(Paragraph(
        "BidBlitz Kids • Sicheres Taschengeld für Ihre Kinder",
        styles['Footer']
    ))
    
    doc.build(elements)
    
    buffer.seek(0)
    return buffer.getvalue()
