"""
BidBlitz V2 - Car Rental Invoices
PDF invoice generation for car rental bookings.
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional
import io

# Note: For production, install reportlab or weasyprint
# pip install reportlab


def generate_invoice_html(invoice: Dict[str, Any]) -> str:
    """Generate HTML invoice for PDF conversion."""
    
    vendor = invoice.get("vendor_company", {})
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Rechnung {invoice['invoice_number']}</title>
        <style>
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; margin: 40px; }}
            .header {{ display: flex; justify-content: space-between; margin-bottom: 40px; }}
            .logo {{ font-size: 24px; font-weight: bold; color: #00C2FF; }}
            .invoice-title {{ font-size: 32px; color: #333; margin-bottom: 5px; }}
            .invoice-number {{ color: #666; font-size: 14px; }}
            .addresses {{ display: flex; justify-content: space-between; margin-bottom: 30px; }}
            .address-block {{ width: 45%; }}
            .address-label {{ font-weight: bold; color: #666; font-size: 10px; margin-bottom: 5px; }}
            table {{ width: 100%; border-collapse: collapse; margin-bottom: 30px; }}
            th {{ background: #f5f5f5; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }}
            td {{ padding: 12px; border-bottom: 1px solid #eee; }}
            .amount {{ text-align: right; }}
            .totals {{ margin-top: 20px; }}
            .totals-row {{ display: flex; justify-content: flex-end; margin-bottom: 5px; }}
            .totals-label {{ width: 150px; text-align: right; padding-right: 20px; }}
            .totals-value {{ width: 100px; text-align: right; font-weight: bold; }}
            .total-final {{ font-size: 18px; color: #00C2FF; border-top: 2px solid #00C2FF; padding-top: 10px; }}
            .footer {{ margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 10px; color: #666; }}
            .bank-details {{ margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <div class="logo">BidBlitz</div>
                <div style="color: #666; font-size: 10px;">Autovermietung</div>
            </div>
            <div style="text-align: right;">
                <div class="invoice-title">RECHNUNG</div>
                <div class="invoice-number">Nr. {invoice['invoice_number']}</div>
                <div style="margin-top: 10px; color: #666;">
                    Rechnungsdatum: {invoice.get('issue_date', '')[:10]}<br>
                    Fällig: {invoice.get('due_date', '')[:10]}
                </div>
            </div>
        </div>
        
        <div class="addresses">
            <div class="address-block">
                <div class="address-label">VON</div>
                <strong>{vendor.get('company_name', '')}</strong><br>
                {vendor.get('address', '')}<br>
                {vendor.get('postal_code', '')} {vendor.get('city', '')}<br>
                {vendor.get('country', 'Deutschland')}<br>
                <br>
                USt-IdNr.: {vendor.get('vat_id', 'N/A')}
            </div>
            <div class="address-block">
                <div class="address-label">AN</div>
                <strong>{invoice.get('customer_name', '')}</strong><br>
                {invoice.get('customer_address', '')}<br>
                {invoice.get('customer_email', '')}
            </div>
        </div>
        
        <div style="background: #f9f9f9; padding: 15px; margin-bottom: 30px; border-radius: 8px;">
            <strong>Buchungsdetails:</strong><br>
            Fahrzeug: {invoice.get('car_title', '')}<br>
            Mietzeitraum: {invoice.get('rental_period', '')}
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Beschreibung</th>
                    <th>Menge</th>
                    <th class="amount">Einzelpreis</th>
                    <th class="amount">MwSt</th>
                    <th class="amount">Gesamt</th>
                </tr>
            </thead>
            <tbody>
    """
    
    for item in invoice.get("line_items", []):
        html += f"""
                <tr>
                    <td>{item['description']}</td>
                    <td>{item['quantity']}</td>
                    <td class="amount">€{item['unit_price']:.2f}</td>
                    <td class="amount">{item['tax_rate']:.0f}%</td>
                    <td class="amount">€{item['total']:.2f}</td>
                </tr>
        """
    
    html += f"""
            </tbody>
        </table>
        
        <div class="totals">
            <div class="totals-row">
                <div class="totals-label">Zwischensumme:</div>
                <div class="totals-value">€{invoice.get('subtotal', 0):.2f}</div>
            </div>
            <div class="totals-row">
                <div class="totals-label">MwSt (19%):</div>
                <div class="totals-value">€{invoice.get('tax_total', 0):.2f}</div>
            </div>
    """
    
    if invoice.get("discount", 0) > 0:
        html += f"""
            <div class="totals-row">
                <div class="totals-label">Rabatt:</div>
                <div class="totals-value">-€{invoice.get('discount', 0):.2f}</div>
            </div>
        """
    
    html += f"""
            <div class="totals-row total-final">
                <div class="totals-label">Gesamtbetrag:</div>
                <div class="totals-value">€{invoice.get('total', 0):.2f}</div>
            </div>
        </div>
        
        <div class="bank-details">
            <strong>Bankverbindung:</strong><br>
            {vendor.get('bank_name', '')}<br>
            IBAN: {vendor.get('iban', '')}<br>
            BIC: {vendor.get('bic', '')}
        </div>
        
        <div class="footer">
            {vendor.get('company_name', '')} | {vendor.get('address', '')} | {vendor.get('city', '')}<br>
            Tel: {vendor.get('phone', '')} | E-Mail: {vendor.get('email', '')}<br>
            Handelsregister: {vendor.get('registration_number', '')} | Steuernummer: {vendor.get('tax_id', '')}
        </div>
    </body>
    </html>
    """
    
    return html


def generate_invoice_text(invoice: Dict[str, Any]) -> str:
    """Generate plain text invoice."""
    
    vendor = invoice.get("vendor_company", {})
    
    lines = [
        "=" * 60,
        f"RECHNUNG Nr. {invoice['invoice_number']}",
        "=" * 60,
        "",
        f"Von: {vendor.get('company_name', '')}",
        f"     {vendor.get('address', '')}",
        f"     {vendor.get('postal_code', '')} {vendor.get('city', '')}",
        "",
        f"An:  {invoice.get('customer_name', '')}",
        f"     {invoice.get('customer_email', '')}",
        "",
        "-" * 60,
        f"Fahrzeug: {invoice.get('car_title', '')}",
        f"Zeitraum: {invoice.get('rental_period', '')}",
        "-" * 60,
        "",
        "POSITIONEN:",
        "",
    ]
    
    for item in invoice.get("line_items", []):
        lines.append(f"  {item['description']}")
        lines.append(f"    {item['quantity']}x €{item['unit_price']:.2f} = €{item['total']:.2f}")
    
    lines.extend([
        "",
        "-" * 60,
        f"Zwischensumme:  €{invoice.get('subtotal', 0):.2f}",
        f"MwSt (19%):     €{invoice.get('tax_total', 0):.2f}",
    ])
    
    if invoice.get("discount", 0) > 0:
        lines.append(f"Rabatt:        -€{invoice.get('discount', 0):.2f}")
    
    lines.extend([
        "-" * 60,
        f"GESAMT:        €{invoice.get('total', 0):.2f}",
        "=" * 60,
        "",
        f"Rechnungsdatum: {invoice.get('issue_date', '')[:10]}",
        f"Fällig bis:     {invoice.get('due_date', '')[:10]}",
    ])
    
    return "\n".join(lines)
