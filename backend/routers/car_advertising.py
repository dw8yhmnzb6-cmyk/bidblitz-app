"""
Car Advertising Router
Handles car advertising applications for €50/month passive income
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from config import db
from utils.email import send_email

router = APIRouter(prefix="/car-advertising", tags=["Car Advertising"])


# ==================== EMAIL TEMPLATES ====================

async def send_car_advertising_approval_email(to_email: str, name: str, car_model: str):
    """Send email when car advertising application is approved."""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#10B981,#059669); padding:30px; text-align:center;">
                    <h1 style="color:#fff; margin:0; font-size:28px;">🎉 Herzlichen Glückwunsch!</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#333;">Hallo <strong>{name}</strong>,</p>
                    <p style="font-size:16px; color:#555;">
                        Großartige Neuigkeiten! Ihre Bewerbung für das Auto-Werbung Programm wurde <strong style="color:#10B981;">genehmigt</strong>! 🚗
                    </p>
                    
                    <table width="100%" style="background:#f9f9f9; border-radius:10px; padding:20px; margin:20px 0;">
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Fahrzeug:</p>
                            <p style="margin:5px 0 0; font-size:18px; color:#333; font-weight:bold;">{car_model}</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Monatliche Vergütung:</p>
                            <p style="margin:5px 0 0; font-size:28px; color:#10B981; font-weight:bold;">€50,00</p>
                        </td></tr>
                    </table>
                    
                    <div style="background:#FEF3C7; border-left:4px solid #F59E0B; padding:15px; margin:20px 0; border-radius:0 10px 10px 0;">
                        <p style="margin:0; font-size:14px; color:#555;">
                            <strong>Nächste Schritte:</strong><br>
                            Unser Team wird sich in Kürze mit Ihnen in Verbindung setzen, um einen Termin für die kostenlose Fahrzeugfolierung zu vereinbaren.
                        </p>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://bidblitz.ae/auto-werbung" 
                           style="display:inline-block; background:#10B981; color:#fff; padding:15px 30px; 
                                  text-decoration:none; border-radius:8px; font-weight:bold; font-size:16px;">
                            Mehr erfahren →
                        </a>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="background:#1a1a1a; padding:20px; text-align:center;">
                    <p style="margin:0; color:#888; font-size:12px;">
                        © 2026 BidBlitz.ae | Auto-Werbung Programm
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"🎉 Auto-Werbung Bewerbung genehmigt - {name}",
        html_content=html_content
    )


async def send_car_advertising_rejection_email(to_email: str, name: str, reason: Optional[str] = None):
    """Send email when car advertising application is rejected."""
    reason_text = f"<p style='font-size:14px; color:#555;'><strong>Grund:</strong> {reason}</p>" if reason else ""
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#6B7280,#4B5563); padding:30px; text-align:center;">
                    <h1 style="color:#fff; margin:0; font-size:28px;">Auto-Werbung Bewerbung</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#333;">Hallo <strong>{name}</strong>,</p>
                    <p style="font-size:16px; color:#555;">
                        Vielen Dank für Ihr Interesse am Auto-Werbung Programm von BidBlitz.
                    </p>
                    <p style="font-size:16px; color:#555;">
                        Leider können wir Ihre Bewerbung zu diesem Zeitpunkt nicht annehmen.
                    </p>
                    
                    {reason_text}
                    
                    <div style="background:#F3F4F6; border-radius:10px; padding:20px; margin:20px 0;">
                        <p style="margin:0; font-size:14px; color:#555;">
                            <strong>💡 Mögliche Gründe:</strong>
                        </p>
                        <ul style="color:#666; font-size:14px; margin:10px 0 0 0; padding-left:20px;">
                            <li>Region derzeit nicht verfügbar</li>
                            <li>Fahrzeugalter über 10 Jahre</li>
                            <li>Zu geringe monatliche Kilometerleistung</li>
                        </ul>
                    </div>
                    
                    <p style="font-size:14px; color:#888;">
                        Sie können sich gerne in Zukunft erneut bewerben, wenn sich Ihre Umstände ändern.
                    </p>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="mailto:support@bidblitz.ae" 
                           style="display:inline-block; background:#6B7280; color:#fff; padding:15px 30px; 
                                  text-decoration:none; border-radius:8px; font-weight:bold; font-size:16px;">
                            Bei Fragen kontaktieren →
                        </a>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="background:#1a1a1a; padding:20px; text-align:center;">
                    <p style="margin:0; color:#888; font-size:12px;">
                        © 2026 BidBlitz.ae | Auto-Werbung Programm
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"Auto-Werbung Bewerbung - Aktualisierung",
        html_content=html_content
    )


async def send_car_advertising_activation_email(to_email: str, name: str, car_model: str):
    """Send email when car advertising contract is activated."""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#FFD700,#FFA500); padding:30px; text-align:center;">
                    <h1 style="color:#111; margin:0; font-size:28px;">🚗 Vertrag aktiviert!</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#333;">Hallo <strong>{name}</strong>,</p>
                    <p style="font-size:16px; color:#555;">
                        Ihr Auto-Werbung Vertrag ist jetzt <strong style="color:#10B981;">aktiv</strong>! 
                        Ab sofort verdienen Sie <strong>€50 pro Monat</strong>! 💰
                    </p>
                    
                    <table width="100%" style="background:#f9f9f9; border-radius:10px; padding:20px; margin:20px 0;">
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Fahrzeug:</p>
                            <p style="margin:5px 0 0; font-size:18px; color:#333; font-weight:bold;">{car_model}</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Monatliche Vergütung:</p>
                            <p style="margin:5px 0 0; font-size:28px; color:#10B981; font-weight:bold;">€50,00</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Vertragsbeginn:</p>
                            <p style="margin:5px 0 0; font-size:18px; color:#333; font-weight:bold;">{datetime.now(timezone.utc).strftime('%d.%m.%Y')}</p>
                        </td></tr>
                    </table>
                    
                    <div style="background:#ECFDF5; border-left:4px solid #10B981; padding:15px; margin:20px 0; border-radius:0 10px 10px 0;">
                        <p style="margin:0; font-size:14px; color:#065F46;">
                            <strong>📅 Auszahlung:</strong><br>
                            Ihre Vergütung wird automatisch am Ende jedes Monats auf Ihr BidBlitz-Wallet gutgeschrieben.
                        </p>
                    </div>
                    
                    <p style="font-size:14px; color:#555;">
                        Vielen Dank, dass Sie BidBlitz auf den Straßen repräsentieren! 🙌
                    </p>
                </td>
            </tr>
            <tr>
                <td style="background:#1a1a1a; padding:20px; text-align:center;">
                    <p style="margin:0; color:#888; font-size:12px;">
                        © 2026 BidBlitz.ae | Auto-Werbung Programm
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"🚗 Auto-Werbung Vertrag aktiviert - €50/Monat ab sofort!",
        html_content=html_content
    )


class CarAdvertisingApplication(BaseModel):
    name: str
    email: EmailStr
    phone: str
    car_brand: str
    car_model: str
    car_year: str
    car_color: str
    license_plate: str
    country: Optional[str] = None
    city: str
    km_per_month: str
    parking_location: Optional[str] = None
    additional_info: Optional[str] = None
    photos: Optional[list] = None
    user_id: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: str
    name: str
    email: str
    car_brand: str
    car_model: str
    license_plate: str
    city: str
    status: str  # pending, approved, active, rejected
    total_earned: float
    contract_start: Optional[str] = None
    created_at: str


@router.post("/apply")
async def apply_for_car_advertising(application: CarAdvertisingApplication):
    """Submit a car advertising application"""
    
    # Check if this email already has an application
    existing = await db.car_advertising.find_one({
        "email": application.email.lower()
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Sie haben bereits eine Anmeldung für Auto-Werbung."
        )
    
    # Check license plate uniqueness
    plate_exists = await db.car_advertising.find_one({
        "license_plate": application.license_plate.upper()
    })
    
    if plate_exists:
        raise HTTPException(
            status_code=400,
            detail="Dieses Kennzeichen wurde bereits registriert."
        )
    
    # Create application
    doc = {
        "name": application.name,
        "email": application.email.lower(),
        "phone": application.phone,
        "car_brand": application.car_brand,
        "car_model": application.car_model,
        "car_year": application.car_year,
        "car_color": application.car_color,
        "license_plate": application.license_plate.upper(),
        "country": application.country,
        "city": application.city,
        "km_per_month": application.km_per_month,
        "parking_location": application.parking_location,
        "additional_info": application.additional_info,
        "photos": application.photos or [],
        "user_id": application.user_id,
        "status": "pending",
        "total_earned": 0,
        "months_active": 0,
        "contract_start": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.car_advertising.insert_one(doc)
    
    # Log the application
    await db.logs.insert_one({
        "type": "car_advertising",
        "message": f"Neue Auto-Werbung Anmeldung: {application.name} ({application.car_brand} {application.car_model})",
        "user_email": application.email,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": "Anmeldung erfolgreich eingereicht",
        "application_id": str(result.inserted_id)
    }


@router.get("/my-application")
async def get_my_application(email: str = Query(...)):
    """Get existing application for a user"""
    
    
    application = await db.car_advertising.find_one(
        {"email": email.lower()},
        {"_id": 0}
    )
    
    if not application:
        return None
    
    return application


@router.get("/all")
async def get_all_applications(status: Optional[str] = None):
    """Get all car advertising applications (admin only)"""
    
    
    query = {}
    if status:
        query["status"] = status
    
    applications = await db.car_advertising.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {"applications": applications, "total": len(applications)}


@router.put("/update-status")
async def update_application_status(
    email: str = Query(...),
    status: str = Query(...),
    admin_note: Optional[str] = None
):
    """Update application status (admin only) and send email notification"""
    
    
    valid_statuses = ["pending", "approved", "active", "rejected"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    # Get the application first to have access to user details
    application = await db.car_advertising.find_one({"email": email.lower()})
    if not application:
        raise HTTPException(status_code=404, detail="Anmeldung nicht gefunden")
    
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if admin_note:
        update_data["admin_note"] = admin_note
    
    if status == "active":
        update_data["contract_start"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.car_advertising.update_one(
        {"email": email.lower()},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Anmeldung nicht gefunden")
    
    # Send email notification based on status
    car_model = f"{application.get('car_brand', '')} {application.get('car_model', '')}".strip()
    user_name = application.get('name', 'Kunde')
    user_email = application.get('email', '')
    
    email_result = None
    if status == "approved":
        email_result = await send_car_advertising_approval_email(user_email, user_name, car_model)
    elif status == "rejected":
        email_result = await send_car_advertising_rejection_email(user_email, user_name, admin_note)
    elif status == "active":
        email_result = await send_car_advertising_activation_email(user_email, user_name, car_model)
    
    return {
        "success": True, 
        "message": f"Status auf {status} aktualisiert",
        "email_sent": email_result.get("status") if email_result else None
    }


@router.post("/process-monthly-payouts")
async def process_monthly_payouts():
    """Process monthly €50 payouts for all active car advertisers"""
    
    
    # Get all active advertisers
    active_advertisers = await db.car_advertising.find(
        {"status": "active"}
    ).to_list(1000)
    
    processed = 0
    total_amount = 0
    
    for advertiser in active_advertisers:
        # Add €50 to their total earned
        await db.car_advertising.update_one(
            {"email": advertiser["email"]},
            {
                "$inc": {
                    "total_earned": 50,
                    "months_active": 1
                },
                "$set": {
                    "last_payout": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # If user exists, add to their wallet
        if advertiser.get("user_id"):
            await db.users.update_one(
                {"id": advertiser["user_id"]},
                {
                    "$inc": {"wallet_balance": 50}
                }
            )
        
        processed += 1
        total_amount += 50
    
    # Log the payout
    await db.logs.insert_one({
        "type": "car_advertising_payout",
        "message": f"Auto-Werbung Monatszahlung: {processed} Fahrer, €{total_amount} gesamt",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "processed": processed,
        "total_amount": total_amount
    }


@router.get("/stats")
async def get_car_advertising_stats():
    """Get statistics for car advertising program"""
    
    
    total = await db.car_advertising.count_documents({})
    pending = await db.car_advertising.count_documents({"status": "pending"})
    approved = await db.car_advertising.count_documents({"status": "approved"})
    active = await db.car_advertising.count_documents({"status": "active"})
    rejected = await db.car_advertising.count_documents({"status": "rejected"})
    
    # Get total payout
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_earned"}}}
    ]
    payout_result = await db.car_advertising.aggregate(pipeline).to_list(1)
    total_paid = payout_result[0]["total"] if payout_result else 0
    
    # Get cities
    cities_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cities = await db.car_advertising.aggregate(cities_pipeline).to_list(100)
    
    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "active": active,
        "rejected": rejected,
        "total_paid_out": total_paid,
        "cities": cities
    }
