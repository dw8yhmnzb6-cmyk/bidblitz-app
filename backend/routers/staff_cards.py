"""
Staff Login Cards - Druckbare Mitarbeiter-Anmeldekarten
Unterstützt sowohl A4-PDF mit mehreren Karten als auch einzelne Visitenkarten
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response, StreamingResponse
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid
import io
import qrcode
import base64

from config import db, logger
from dependencies import get_admin_user

router = APIRouter(prefix="/staff-cards", tags=["Staff Cards"])

# Base URL for login
BASE_URL = "https://bidblitz.ae"


# ==================== SCHEMAS ====================

class StaffCardRequest(BaseModel):
    staff_ids: List[str]


class SingleCardRequest(BaseModel):
    staff_id: str


# ==================== HELPER FUNCTIONS ====================

def generate_qr_code_base64(data: str, size: int = 150) -> str:
    """Generate QR code as base64 string"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Resize
    img = img.resize((size, size))
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def generate_staff_card_html(staff: dict, partner: dict, card_style: str = "single") -> str:
    """Generate HTML for a single staff card"""
    staff_name = staff.get("name", "Mitarbeiter")
    staff_number = staff.get("staff_number", staff.get("id", "")[:8])
    partner_name = partner.get("business_name", partner.get("name", "Partner"))
    
    # Generate QR code with login URL
    login_url = f"{BASE_URL}/staff-login?id={staff_number}&partner={partner.get('id', '')[:8]}"
    qr_base64 = generate_qr_code_base64(login_url)
    
    if card_style == "single":
        # Visitenkarten-Format (85mm x 55mm)
        return f"""
        <div class="card single-card" style="width: 85mm; height: 55mm; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; box-sizing: border-box; display: flex; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);">
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">BidBlitz Partner-Mitarbeiter</div>
                    <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">{staff_name}</div>
                    <div style="font-size: 11px; color: #475569;">{partner_name}</div>
                </div>
                <div>
                    <div style="font-size: 9px; color: #94a3b8;">Kundennummer</div>
                    <div style="font-size: 18px; font-weight: 800; color: #f59e0b; letter-spacing: 1px;">{staff_number}</div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <img src="data:image/png;base64,{qr_base64}" alt="QR" style="width: 45mm; height: 45mm;">
                <div style="font-size: 7px; color: #94a3b8; text-align: center;">Zum Anmelden scannen</div>
            </div>
        </div>
        """
    else:
        # A4-Karte (kleiner)
        return f"""
        <div class="card a4-card" style="width: 90mm; height: 55mm; border: 1px solid #d1d5db; border-radius: 6px; padding: 6px; box-sizing: border-box; display: flex; background: white; margin: 3mm;">
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="font-size: 8px; color: #6b7280;">BidBlitz</div>
                    <div style="font-size: 12px; font-weight: 600; color: #111827;">{staff_name}</div>
                    <div style="font-size: 9px; color: #4b5563;">{partner_name}</div>
                </div>
                <div>
                    <div style="font-size: 7px; color: #9ca3af;">Kundennummer</div>
                    <div style="font-size: 16px; font-weight: 700; color: #d97706;">{staff_number}</div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <img src="data:image/png;base64,{qr_base64}" alt="QR" style="width: 40mm; height: 40mm;">
                <div style="font-size: 6px; color: #9ca3af;">Scannen</div>
            </div>
        </div>
        """


# ==================== ENDPOINTS ====================

@router.get("/preview/{staff_id}")
async def preview_staff_card(staff_id: str, token: str):
    """Preview a single staff card"""
    # Verify partner
    partner = await db.partner_accounts.find_one({"auth_token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    # Find staff member
    staff = await db.partner_staff.find_one({
        "id": staff_id,
        "partner_id": partner["id"]
    }, {"_id": 0})
    
    if not staff:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    
    card_html = generate_staff_card_html(staff, partner, "single")
    
    return {
        "staff_id": staff_id,
        "staff_name": staff.get("name"),
        "staff_number": staff.get("staff_number"),
        "card_html": card_html,
        "qr_data": f"{BASE_URL}/staff-login?id={staff.get('staff_number')}&partner={partner['id'][:8]}"
    }


@router.get("/single/{staff_id}")
async def get_single_staff_card(staff_id: str, token: str):
    """Get a single printable staff card (Visitenkarten-Format)"""
    # Verify partner
    partner = await db.partner_accounts.find_one({"auth_token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    # Find staff member
    staff = await db.partner_staff.find_one({
        "id": staff_id,
        "partner_id": partner["id"]
    }, {"_id": 0})
    
    if not staff:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    
    card_html = generate_staff_card_html(staff, partner, "single")
    
    # Generate full HTML page for printing
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Mitarbeiterkarte - {staff.get('name', 'Mitarbeiter')}</title>
        <style>
            @media print {{
                @page {{
                    size: 90mm 58mm;
                    margin: 0;
                }}
                body {{
                    margin: 0;
                    padding: 0;
                }}
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: #f3f4f6;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
            }}
            .print-container {{
                background: white;
                padding: 10px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }}
            .print-btn {{
                display: block;
                margin: 20px auto;
                padding: 12px 24px;
                background: #f59e0b;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
            }}
            .print-btn:hover {{
                background: #d97706;
            }}
            @media print {{
                .print-btn {{ display: none; }}
                .print-container {{ box-shadow: none; padding: 0; }}
            }}
        </style>
    </head>
    <body>
        <div>
            <div class="print-container">
                {card_html}
            </div>
            <button class="print-btn" onclick="window.print()">🖨️ Karte drucken</button>
        </div>
    </body>
    </html>
    """
    
    return Response(content=html_content, media_type="text/html")


@router.post("/a4-sheet")
async def get_a4_staff_cards(data: StaffCardRequest, token: str):
    """Get A4 sheet with multiple staff cards (up to 10 cards per page)"""
    # Verify partner
    partner = await db.partner_accounts.find_one({"auth_token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    if len(data.staff_ids) > 20:
        raise HTTPException(status_code=400, detail="Maximal 20 Mitarbeiter pro Anfrage")
    
    # Get all staff members
    staff_members = []
    for staff_id in data.staff_ids:
        staff = await db.partner_staff.find_one({
            "id": staff_id,
            "partner_id": partner["id"]
        }, {"_id": 0})
        if staff:
            staff_members.append(staff)
    
    if not staff_members:
        raise HTTPException(status_code=404, detail="Keine Mitarbeiter gefunden")
    
    # Generate cards
    cards_html = ""
    for staff in staff_members:
        cards_html += generate_staff_card_html(staff, partner, "a4")
    
    # Generate full HTML page for A4 printing
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Mitarbeiterkarten - {partner.get('business_name', 'Partner')}</title>
        <style>
            @media print {{
                @page {{
                    size: A4;
                    margin: 10mm;
                }}
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f3f4f6;
                margin: 0;
                padding: 20px;
            }}
            .page-header {{
                text-align: center;
                margin-bottom: 20px;
            }}
            .page-header h1 {{
                font-size: 24px;
                color: #1e293b;
                margin: 0 0 8px 0;
            }}
            .page-header p {{
                font-size: 14px;
                color: #64748b;
                margin: 0;
            }}
            .cards-container {{
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 10px;
                max-width: 210mm;
                margin: 0 auto;
            }}
            .print-btn {{
                display: block;
                margin: 20px auto;
                padding: 12px 24px;
                background: #f59e0b;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
            }}
            .print-btn:hover {{
                background: #d97706;
            }}
            @media print {{
                .print-btn, .page-header {{ display: none; }}
                body {{ background: white; padding: 0; }}
            }}
        </style>
    </head>
    <body>
        <div class="page-header">
            <h1>Mitarbeiterkarten</h1>
            <p>{partner.get('business_name', 'Partner')} - {len(staff_members)} Karten</p>
        </div>
        <div class="cards-container">
            {cards_html}
        </div>
        <button class="print-btn" onclick="window.print()">🖨️ Alle Karten drucken (A4)</button>
    </body>
    </html>
    """
    
    return Response(content=html_content, media_type="text/html")


@router.get("/all")
async def get_all_staff_cards(token: str):
    """Get all staff cards for a partner as A4 sheet"""
    # Verify partner
    partner = await db.partner_accounts.find_one({"auth_token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    # Get all staff
    staff_members = await db.partner_staff.find(
        {"partner_id": partner["id"], "is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    if not staff_members:
        raise HTTPException(status_code=404, detail="Keine aktiven Mitarbeiter gefunden")
    
    # Generate cards
    cards_html = ""
    for staff in staff_members:
        cards_html += generate_staff_card_html(staff, partner, "a4")
    
    # Generate full HTML page
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Alle Mitarbeiterkarten - {partner.get('business_name', 'Partner')}</title>
        <style>
            @media print {{
                @page {{
                    size: A4;
                    margin: 10mm;
                }}
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f3f4f6;
                margin: 0;
                padding: 20px;
            }}
            .page-header {{
                text-align: center;
                margin-bottom: 20px;
            }}
            .page-header h1 {{
                font-size: 24px;
                color: #1e293b;
                margin: 0 0 8px 0;
            }}
            .page-header p {{
                font-size: 14px;
                color: #64748b;
                margin: 0;
            }}
            .cards-container {{
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 10px;
                max-width: 210mm;
                margin: 0 auto;
            }}
            .print-btn {{
                display: block;
                margin: 20px auto;
                padding: 12px 24px;
                background: #f59e0b;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
            }}
            .print-btn:hover {{
                background: #d97706;
            }}
            @media print {{
                .print-btn, .page-header {{ display: none; }}
                body {{ background: white; padding: 0; }}
            }}
        </style>
    </head>
    <body>
        <div class="page-header">
            <h1>Mitarbeiterkarten</h1>
            <p>{partner.get('business_name', 'Partner')} - {len(staff_members)} aktive Mitarbeiter</p>
        </div>
        <div class="cards-container">
            {cards_html}
        </div>
        <button class="print-btn" onclick="window.print()">🖨️ Alle Karten drucken (A4)</button>
    </body>
    </html>
    """
    
    return Response(content=html_content, media_type="text/html")


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/all-partners")
async def admin_get_all_staff_cards(admin: dict = Depends(get_admin_user)):
    """Admin: Get staff cards for all partners"""
    
    # Get all partners with staff
    all_staff = await db.partner_staff.find(
        {"active": True},
        {"_id": 0}
    ).to_list(200)
    
    if not all_staff:
        raise HTTPException(status_code=404, detail="Keine Mitarbeiter gefunden")
    
    # Group by partner and generate cards
    cards_html = ""
    partner_cache = {}
    
    for staff in all_staff:
        partner_id = staff.get("partner_id")
        if partner_id not in partner_cache:
            partner = await db.partner_accounts.find_one({"id": partner_id}, {"_id": 0})
            partner_cache[partner_id] = partner or {"business_name": "Unbekannt", "id": partner_id}
        
        partner = partner_cache[partner_id]
        cards_html += generate_staff_card_html(staff, partner, "a4")
    
    # Generate full HTML page
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Alle Mitarbeiterkarten - Admin</title>
        <style>
            @media print {{
                @page {{
                    size: A4;
                    margin: 10mm;
                }}
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f3f4f6;
                margin: 0;
                padding: 20px;
            }}
            .page-header {{
                text-align: center;
                margin-bottom: 20px;
            }}
            .page-header h1 {{
                font-size: 24px;
                color: #1e293b;
                margin: 0 0 8px 0;
            }}
            .page-header p {{
                font-size: 14px;
                color: #64748b;
                margin: 0;
            }}
            .cards-container {{
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 10px;
                max-width: 210mm;
                margin: 0 auto;
            }}
            .print-btn {{
                display: block;
                margin: 20px auto;
                padding: 12px 24px;
                background: #f59e0b;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
            }}
            .print-btn:hover {{
                background: #d97706;
            }}
            @media print {{
                .print-btn, .page-header {{ display: none; }}
                body {{ background: white; padding: 0; }}
            }}
        </style>
    </head>
    <body>
        <div class="page-header">
            <h1>Alle Mitarbeiterkarten</h1>
            <p>Admin-Ansicht - {len(all_staff)} Mitarbeiter von {len(partner_cache)} Partnern</p>
        </div>
        <div class="cards-container">
            {cards_html}
        </div>
        <button class="print-btn" onclick="window.print()">🖨️ Alle Karten drucken (A4)</button>
    </body>
    </html>
    """
    
    return Response(content=html_content, media_type="text/html")


staff_cards_router = router
