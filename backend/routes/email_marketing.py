"""
BidBlitz V2 - Marketing Emails & Notification Emails
Admin kann Newsletter/Angebote senden, System sendet automatische Benachrichtigungen
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.email import send_email
import secrets

router = APIRouter(prefix="/api/email-marketing", tags=["email-marketing"])


# ═══ MARKETING EMAILS (Admin) ═══

class CampaignCreate(BaseModel):
    subject: str
    html_content: str = ""
    plain_text: str = ""
    target: str = "all"  # all | active | merchants | kids_parents | premium
    test_email: str = ""  # Send to single email first


@router.post("/campaign/send")
async def send_campaign(req: CampaignCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")

    now = datetime.now(timezone.utc).isoformat()
    campaign_id = secrets.token_hex(8)

    # Build HTML if only plain text
    html = req.html_content or f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0F;color:white;padding:30px;border-radius:16px">
        <div style="text-align:center;margin-bottom:20px">
            <h1 style="color:#00C2FF;font-size:24px;margin:0">BidBlitz</h1>
        </div>
        <h2 style="color:white;font-size:18px">{req.subject}</h2>
        <p style="color:#aaa;font-size:14px;line-height:1.6">{req.plain_text}</p>
        <div style="margin-top:30px;text-align:center">
            <a href="https://bidblitz.com" style="background:#00C2FF;color:black;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Jetzt öffnen</a>
        </div>
        <p style="color:#666;font-size:10px;margin-top:30px;text-align:center">BidBlitz V2 Super App — Du erhältst diese E-Mail als BidBlitz-Nutzer.</p>
    </div>"""

    # Test mode — send to single email
    if req.test_email:
        success = send_email(req.test_email, req.subject, html)
        return {"ok": True, "mode": "test", "sent_to": req.test_email, "success": success}

    # Build recipient list
    query = {}
    if req.target == "active":
        query["balance"] = {"$gt": 0}
    elif req.target == "merchants":
        query["role"] = "merchant"
    elif req.target == "premium":
        query["role"] = {"$in": ["premium", "vip"]}

    users = await db.users.find(query, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
    emails = [u["email"] for u in users if u.get("email")]

    # Send in batches
    sent = 0
    failed = 0
    for email in emails:
        if send_email(email, req.subject, html):
            sent += 1
        else:
            failed += 1

    # Log campaign
    campaign = {
        "campaign_id": campaign_id,
        "subject": req.subject,
        "target": req.target,
        "total_recipients": len(emails),
        "sent": sent,
        "failed": failed,
        "created_by": str(user.get("email", "")),
        "created_at": now,
    }
    await db.email_campaigns.insert_one(campaign)
    campaign.pop("_id", None)

    return {"ok": True, "campaign": campaign}


@router.get("/campaigns")
async def list_campaigns(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    campaigns = await db.email_campaigns.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"campaigns": campaigns}


# ═══ NOTIFICATION TEMPLATES ═══

TEMPLATES = {
    "hotel_booking": {
        "subject": "Buchung bestätigt: {property_title}",
        "body": """Ihre Buchung wurde bestätigt!
        
<b>Unterkunft:</b> {property_title}<br>
<b>Check-in:</b> {check_in}<br>
<b>Check-out:</b> {check_out}<br>
<b>Nächte:</b> {nights}<br>
<b>Gesamtpreis:</b> €{total}<br>
<b>Cashback:</b> €{cashback}<br>
<b>Referenz:</b> {reference}""",
    },
    "event_ticket": {
        "subject": "Ticket gekauft: {event_title}",
        "body": """Ihr Ticket wurde bestätigt!
        
<b>Event:</b> {event_title}<br>
<b>Datum:</b> {event_date} {event_time}<br>
<b>Typ:</b> {ticket_type}<br>
<b>Anzahl:</b> {quantity}<br>
<b>QR-Code:</b> {qr_code}""",
    },
    "restaurant_reservation": {
        "subject": "Reservierung bestätigt: {restaurant_name}",
        "body": """Ihre Tischreservierung wurde bestätigt!
        
<b>Restaurant:</b> {restaurant_name}<br>
<b>Datum:</b> {date}<br>
<b>Uhrzeit:</b> {time}<br>
<b>Personen:</b> {guests}<br>
<b>Referenz:</b> {reference}""",
    },
    "flight_booking": {
        "subject": "Flug gebucht: {origin_code} → {destination_code}",
        "body": """Ihre Flugbuchung wurde bestätigt!
        
<b>Flug:</b> {airline} {flight_number}<br>
<b>Route:</b> {origin_code} → {destination_code}<br>
<b>Datum:</b> {departure_date} {departure_time}<br>
<b>Klasse:</b> {travel_class}<br>
<b>PNR:</b> {pnr}<br>
<b>Preis:</b> €{total}""",
    },
    "parcel_shipped": {
        "subject": "Paket versendet: {tracking_number}",
        "body": """Ihr Paket wurde gebucht!
        
<b>Carrier:</b> {carrier_name}<br>
<b>Sendungsnummer:</b> {tracking_number}<br>
<b>Empfänger:</b> {recipient_name}, {recipient_city}<br>
<b>Preis:</b> €{price}""",
    },
    "insurance_purchased": {
        "subject": "Versicherung abgeschlossen: {product_title}",
        "body": """Ihre Versicherung wurde aktiviert!
        
<b>Produkt:</b> {product_title}<br>
<b>Anbieter:</b> {provider}<br>
<b>Abrechnung:</b> {billing}<br>
<b>Preis:</b> €{price}<br>
<b>Referenz:</b> {reference}""",
    },
    "appointment_booked": {
        "subject": "Termin bestätigt: {provider_name}",
        "body": """Ihr Termin wurde bestätigt!
        
<b>Anbieter:</b> {provider_name}<br>
<b>Datum:</b> {date}<br>
<b>Uhrzeit:</b> {time}<br>
<b>Service:</b> {service}<br>
<b>Referenz:</b> {reference}""",
    },
    "job_application": {
        "subject": "Bewerbung gesendet: {job_title}",
        "body": """Ihre Bewerbung wurde eingereicht!
        
<b>Job:</b> {job_title}<br>
<b>Unternehmen:</b> {company_name}<br>
<b>Status:</b> Ausstehend<br>
<br>Wir melden uns bei Ihnen!""",
    },
    "tip_received": {
        "subject": "Trinkgeld erhalten: €{amount}",
        "body": """Sie haben ein Trinkgeld erhalten!
        
<b>Betrag:</b> €{amount}<br>
<b>Von:</b> {sender_name}<br>
{message_line}
<b>Referenz:</b> {reference}""",
    },
}


def send_notification_email(to: str, template_key: str, data: dict):
    """Send a templated notification email."""
    template = TEMPLATES.get(template_key)
    if not template:
        return False

    try:
        subject = template["subject"].format(**{k: data.get(k, "") for k in _extract_keys(template["subject"])})
        body = template["body"].format(**{k: data.get(k, "") for k in _extract_keys(template["body"])})
    except (KeyError, IndexError):
        subject = template["subject"]
        body = template["body"]

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0F;color:white;padding:30px;border-radius:16px">
        <div style="text-align:center;margin-bottom:20px">
            <h1 style="color:#00C2FF;font-size:24px;margin:0">BidBlitz</h1>
        </div>
        <div style="background:#111118;padding:20px;border-radius:12px;border:1px solid rgba(255,255,255,0.05)">
            <h2 style="color:white;font-size:16px;margin:0 0 12px">{subject}</h2>
            <div style="color:#aaa;font-size:13px;line-height:1.8">{body}</div>
        </div>
        <p style="color:#666;font-size:10px;margin-top:20px;text-align:center">BidBlitz V2 Super App</p>
    </div>"""

    return send_email(to, f"BidBlitz — {subject}", html)


def _extract_keys(template_str):
    """Extract format keys from template string."""
    import re
    return re.findall(r'\{(\w+)\}', template_str)


# ─── API to trigger notification emails ───

@router.post("/notify")
async def send_notification(request: Request):
    """Internal API to send notification emails. Called by other routes."""
    user = await get_current_user(request)
    body = await request.json()
    template = body.get("template", "")
    to_email = body.get("to", user.get("email", ""))
    data = body.get("data", {})

    if not template or not to_email:
        raise HTTPException(status_code=400, detail="Template und E-Mail erforderlich")

    success = send_notification_email(to_email, template, data)
    return {"ok": True, "sent": success}
