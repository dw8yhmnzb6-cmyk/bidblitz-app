"""
PDF Lohnzettel Generator
=========================
Generate monthly payslip PDFs for staff members
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from io import BytesIO
from datetime import datetime, timezone
import calendar

def generate_payslip_pdf(staff, period_start, period_end, work_hours_data, hourly_rate):
    """
    Generate PDF payslip
    
    Args:
        staff: Staff member dict
        period_start: ISO date string
        period_end: ISO date string
        work_hours_data: Dict with hours breakdown
        hourly_rate: Float
    
    Returns:
        BytesIO buffer with PDF content
    """
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Header
    p.setFont("Helvetica-Bold", 20)
    p.drawString(2*cm, height - 3*cm, "BidBlitz Lohnzettel")
    
    p.setFont("Helvetica", 10)
    p.drawString(2*cm, height - 4*cm, f"Zeitraum: {period_start} bis {period_end}")
    
    # Staff Info
    p.setFont("Helvetica-Bold", 12)
    p.drawString(2*cm, height - 5.5*cm, "Mitarbeiter")
    p.setFont("Helvetica", 10)
    p.drawString(2*cm, height - 6.2*cm, f"Name: {staff.get('name', 'N/A')}")
    p.drawString(2*cm, height - 6.8*cm, f"E-Mail: {staff.get('email', 'N/A')}")
    p.drawString(2*cm, height - 7.4*cm, f"Rolle: {staff.get('role', 'employee')}")
    
    # Work Hours Table
    y_pos = height - 9*cm
    p.setFont("Helvetica-Bold", 12)
    p.drawString(2*cm, y_pos, "Arbeitsstunden")
    
    y_pos -= 0.8*cm
    p.setFont("Helvetica", 10)
    p.drawString(2*cm, y_pos, f"Gesamtstunden: {work_hours_data.get('total_hours', 0):.2f}h")
    y_pos -= 0.6*cm
    p.drawString(2*cm, y_pos, f"Pausen: {work_hours_data.get('break_hours', 0):.2f}h")
    y_pos -= 0.6*cm
    p.drawString(2*cm, y_pos, f"Netto Arbeitsstunden: {work_hours_data.get('net_hours', 0):.2f}h")
    y_pos -= 0.6*cm
    p.drawString(2*cm, y_pos, f"Überstunden: {work_hours_data.get('overtime_hours', 0):.2f}h")
    
    # Salary Calculation
    y_pos -= 1.5*cm
    p.setFont("Helvetica-Bold", 12)
    p.drawString(2*cm, y_pos, "Lohnberechnung")
    
    net_hours = work_hours_data.get('net_hours', 0)
    overtime_hours = work_hours_data.get('overtime_hours', 0)
    regular_hours = net_hours - overtime_hours
    
    regular_pay = regular_hours * hourly_rate
    overtime_pay = overtime_hours * hourly_rate * 1.5  # 150% for overtime
    total_pay = regular_pay + overtime_pay
    
    y_pos -= 0.8*cm
    p.setFont("Helvetica", 10)
    p.drawString(2*cm, y_pos, f"Stundenlohn: €{hourly_rate:.2f}")
    y_pos -= 0.6*cm
    p.drawString(2*cm, y_pos, f"Reguläre Stunden ({regular_hours:.2f}h): €{regular_pay:.2f}")
    y_pos -= 0.6*cm
    p.drawString(2*cm, y_pos, f"Überstunden ({overtime_hours:.2f}h @ 150%): €{overtime_pay:.2f}")
    
    # Total
    y_pos -= 1*cm
    p.setFont("Helvetica-Bold", 14)
    p.drawString(2*cm, y_pos, f"Gesamt Brutto: €{total_pay:.2f}")
    
    # Footer
    p.setFont("Helvetica", 8)
    p.drawString(2*cm, 2*cm, f"Erstellt am: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    p.drawString(2*cm, 1.5*cm, "BidBlitz Staff Management System")
    
    p.showPage()
    p.save()
    
    buffer.seek(0)
    return buffer
