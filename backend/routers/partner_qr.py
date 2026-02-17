"""
Partner QR Code Generator - Druckbare QR-Codes für Partner-Marketing
QR-Codes für Tischaufsteller, Flyer, Schaufenster
"""
from fastapi import APIRouter, HTTPException, Response
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import uuid
import qrcode
import io
import base64

from config import db, logger

router = APIRouter(prefix="/partner-qr", tags=["Partner QR Codes"])

# ==================== SCHEMAS ====================

class QRCodeRequest(BaseModel):
    type: str = "partner"  # partner, voucher, auction
    target_id: str
    style: str = "default"  # default, minimal, branded
    size: int = 300  # pixels
    include_logo: bool = True
    color: str = "#000000"
    bg_color: str = "#FFFFFF"

class QRCodeResponse(BaseModel):
    qr_base64: str
    qr_url: str
    download_url: str

# ==================== ENDPOINTS ====================

@router.get("/generate")
async def generate_partner_qr(
    token: str,
    qr_type: str = "profile",  # profile, vouchers, menu
    size: int = 300,
    color: str = "000000",
    bg_color: str = "FFFFFF"
):
    """Generate QR code for partner profile or vouchers"""
    # Verify partner
    partner = await db.partners.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    partner_name = partner.get("name", "Partner")
    
    # Build target URL based on type
    base_url = "https://bidblitz.ae"
    if qr_type == "profile":
        target_url = f"{base_url}/partner/{partner_id}"
    elif qr_type == "vouchers":
        target_url = f"{base_url}/vouchers?partner={partner_id}"
    elif qr_type == "menu":
        target_url = f"{base_url}/partner/{partner_id}/menu"
    else:
        target_url = f"{base_url}/partner/{partner_id}"
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(target_url)
    qr.make(fit=True)
    
    # Create image with colors
    img = qr.make_image(fill_color=f"#{color}", back_color=f"#{bg_color}")
    
    # Resize to requested size
    img = img.resize((size, size))
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Track QR generation
    qr_id = str(uuid.uuid4())
    await db.partner_qr_codes.insert_one({
        "id": qr_id,
        "partner_id": partner_id,
        "type": qr_type,
        "target_url": target_url,
        "scans": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "qr_base64": f"data:image/png;base64,{qr_base64}",
        "target_url": target_url,
        "qr_id": qr_id,
        "partner_name": partner_name
    }


@router.get("/download")
async def download_qr_image(
    token: str,
    qr_type: str = "profile",
    size: int = 500,
    format: str = "png"  # png, svg
):
    """Download QR code as image file"""
    # Verify partner
    partner = await db.partners.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    # Build target URL
    base_url = "https://bidblitz.ae"
    if qr_type == "profile":
        target_url = f"{base_url}/partner/{partner_id}"
    elif qr_type == "vouchers":
        target_url = f"{base_url}/vouchers?partner={partner_id}"
    else:
        target_url = f"{base_url}/partner/{partner_id}"
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(target_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img = img.resize((size, size))
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="image/png",
        headers={
            "Content-Disposition": f"attachment; filename=bidblitz_qr_{qr_type}.png"
        }
    )


@router.post("/track-scan/{qr_id}")
async def track_qr_scan(qr_id: str, user_agent: Optional[str] = None, location: Optional[str] = None):
    """Track when a QR code is scanned"""
    qr = await db.partner_qr_codes.find_one({"id": qr_id})
    if not qr:
        raise HTTPException(status_code=404, detail="QR-Code nicht gefunden")
    
    # Increment scan count
    await db.partner_qr_codes.update_one(
        {"id": qr_id},
        {"$inc": {"scans": 1}}
    )
    
    # Log scan details
    await db.qr_scans.insert_one({
        "id": str(uuid.uuid4()),
        "qr_id": qr_id,
        "partner_id": qr.get("partner_id"),
        "user_agent": user_agent,
        "location": location,
        "scanned_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "target_url": qr.get("target_url")}


@router.get("/stats")
async def get_qr_stats(token: str):
    """Get QR code statistics for partner"""
    partner = await db.partners.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    # Get all QR codes for partner
    qr_codes = await db.partner_qr_codes.find(
        {"partner_id": partner_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_scans = sum(qr.get("scans", 0) for qr in qr_codes)
    
    # Get scan history (last 30 days)
    from datetime import timedelta
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    scan_history = await db.qr_scans.find(
        {"partner_id": partner_id, "scanned_at": {"$gte": thirty_days_ago}},
        {"_id": 0, "scanned_at": 1}
    ).to_list(1000)
    
    # Group by day
    daily_scans = {}
    for scan in scan_history:
        day = scan["scanned_at"][:10]
        daily_scans[day] = daily_scans.get(day, 0) + 1
    
    return {
        "total_qr_codes": len(qr_codes),
        "total_scans": total_scans,
        "qr_codes": qr_codes,
        "daily_scans": daily_scans
    }


@router.get("/print-template")
async def get_print_template(token: str, template_type: str = "table_tent"):
    """Get printable template with QR code"""
    partner = await db.partners.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    partner_name = partner.get("name", "Partner")
    logo_url = partner.get("logo_url")
    
    # Generate QR code
    target_url = f"https://bidblitz.ae/partner/{partner_id}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(target_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img = img.resize((400, 400))
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Template data
    templates = {
        "table_tent": {
            "name": "Tischaufsteller",
            "size": "10x15cm",
            "description": "Perfekt für Restaurant-Tische"
        },
        "flyer": {
            "name": "Flyer",
            "size": "A6",
            "description": "Zum Auslegen oder Verteilen"
        },
        "window": {
            "name": "Schaufenster-Aufkleber",
            "size": "15x15cm",
            "description": "Für Ladenfenster"
        },
        "receipt": {
            "name": "Kassenbon-Zusatz",
            "size": "8cm breit",
            "description": "Für Kassensysteme"
        }
    }
    
    template = templates.get(template_type, templates["table_tent"])
    
    return {
        "partner_name": partner_name,
        "logo_url": logo_url,
        "qr_base64": f"data:image/png;base64,{qr_base64}",
        "target_url": target_url,
        "template": template,
        "template_type": template_type,
        "available_templates": list(templates.keys())
    }
