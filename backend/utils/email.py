"""Email utilities using Resend"""
import os
import asyncio
import logging
import resend

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

if RESEND_API_KEY and RESEND_API_KEY != 're_123_placeholder':
    resend.api_key = RESEND_API_KEY

async def send_email(to_email: str, subject: str, html_content: str) -> dict:
    """Send email using Resend API. Returns success status."""
    if not RESEND_API_KEY or RESEND_API_KEY == 're_123_placeholder':
        logger.warning(f"[EMAIL MOCK] No valid RESEND_API_KEY - Would send to {to_email}: {subject}")
        return {"status": "mocked", "message": f"Email would be sent to {to_email}"}
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"[EMAIL SENT] To: {to_email}, Subject: {subject}")
        return {"status": "sent", "email_id": result.get("id")}
    except Exception as e:
        logger.error(f"[EMAIL ERROR] Failed to send to {to_email}: {str(e)}")
        return {"status": "error", "message": str(e)}

async def send_winner_notification(winner_email: str, winner_name: str, product_name: str, 
                                   final_price: float, retail_price: float, auction_id: str):
    """Send winner notification email with auction details."""
    savings = ((retail_price - final_price) / retail_price * 100) if retail_price > 0 else 0
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#FFD700,#FF4D4D); padding:30px; text-align:center;">
                    <h1 style="color:#111; margin:0; font-size:28px;">🎉 Herzlichen Glückwunsch!</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#333;">Hallo <strong>{winner_name}</strong>,</p>
                    <p style="font-size:16px; color:#555;">Sie haben die Auktion gewonnen! 🏆</p>
                    <table width="100%" style="background:#f9f9f9; border-radius:10px; padding:20px; margin:20px 0;">
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Produkt:</p>
                            <p style="margin:5px 0 0; font-size:18px; color:#333; font-weight:bold;">{product_name}</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Ihr Gewinnpreis:</p>
                            <p style="margin:5px 0 0; font-size:28px; color:#10B981; font-weight:bold;">€{final_price:.2f}</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">UVP:</p>
                            <p style="margin:5px 0 0; font-size:16px; color:#999; text-decoration:line-through;">€{retail_price:.2f}</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Sie sparen:</p>
                            <p style="margin:5px 0 0; font-size:18px; color:#FF4D4D; font-weight:bold;">{savings:.0f}%</p>
                        </td></tr>
                    </table>
                    <p style="font-size:12px; color:#999;">Auktions-ID: {auction_id}</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=winner_email,
        subject=f"🎉 Gewonnen: {product_name} für nur €{final_price:.2f}!",
        html_content=html_content
    )

async def send_password_reset_email(to_email: str, reset_code: str, user_name: str):
    """Send password reset code email."""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:#111; padding:30px; text-align:center;">
                    <h1 style="color:#FFD700; margin:0; font-size:24px;">Passwort zurücksetzen</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:16px; color:#333;">Hallo {user_name},</p>
                    <p style="font-size:14px; color:#555;">Sie haben angefordert, Ihr Passwort zurückzusetzen. Verwenden Sie den folgenden Code:</p>
                    <div style="background:#f5f5f5; padding:20px; text-align:center; margin:20px 0; border-radius:10px;">
                        <span style="font-size:32px; font-weight:bold; letter-spacing:8px; color:#111; font-family:monospace;">
                            {reset_code}
                        </span>
                    </div>
                    <p style="font-size:14px; color:#888;">Dieser Code ist 15 Minuten gültig.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"Ihr Passwort-Reset-Code: {reset_code}",
        html_content=html_content
    )

# ==================== INFLUENCER EMAIL NOTIFICATIONS ====================

async def send_influencer_new_sale_notification(
    influencer_email: str,
    influencer_name: str,
    customer_name: str,
    purchase_amount: float,
    commission_rate: float,
    commission_earned: float,
    total_commission: float
):
    """Send notification to influencer when a referred customer makes a purchase."""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#FFD700,#FFA500); padding:30px; text-align:center;">
                    <h1 style="color:#111; margin:0; font-size:28px;">💰 Neue Provision!</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#333;">Hallo <strong>{influencer_name}</strong>,</p>
                    <p style="font-size:16px; color:#555;">Großartige Neuigkeiten! Ein von Ihnen geworbener Kunde hat eingekauft! 🎉</p>
                    
                    <table width="100%" style="background:#f9f9f9; border-radius:10px; padding:20px; margin:20px 0;">
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Kunde:</p>
                            <p style="margin:5px 0 0; font-size:18px; color:#333; font-weight:bold;">{customer_name}</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Kaufbetrag:</p>
                            <p style="margin:5px 0 0; font-size:18px; color:#333;">€{purchase_amount:.2f}</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Ihre Provision ({commission_rate:.0f}%):</p>
                            <p style="margin:5px 0 0; font-size:28px; color:#10B981; font-weight:bold;">+€{commission_earned:.2f}</p>
                        </td></tr>
                    </table>
                    
                    <div style="background:#FFF9E6; border-left:4px solid #FFD700; padding:15px; margin:20px 0; border-radius:0 10px 10px 0;">
                        <p style="margin:0; font-size:14px; color:#555;">
                            <strong>Gesamt verfügbare Provision:</strong><br>
                            <span style="font-size:24px; color:#333; font-weight:bold;">€{total_commission:.2f}</span>
                        </p>
                        <p style="margin:10px 0 0; font-size:12px; color:#888;">
                            Ab €50.00 können Sie eine Auszahlung anfordern.
                        </p>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://BidBlitz.ae/influencer-dashboard" 
                           style="display:inline-block; background:#FFD700; color:#111; padding:15px 30px; 
                                  text-decoration:none; border-radius:8px; font-weight:bold; font-size:16px;">
                            Zum Dashboard →
                        </a>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="background:#f5f5f5; padding:20px; text-align:center;">
                    <p style="margin:0; font-size:12px; color:#888;">
                        Vielen Dank, dass Sie Teil des BidBlitz.ae Influencer-Programms sind!
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=influencer_email,
        subject=f"💰 Neue Provision: +€{commission_earned:.2f} von {customer_name}",
        html_content=html_content
    )

async def send_influencer_new_signup_notification(
    influencer_email: str,
    influencer_name: str,
    new_user_name: str
):
    """Send notification to influencer when someone signs up with their code."""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#7C3AED,#A855F7); padding:30px; text-align:center;">
                    <h1 style="color:#fff; margin:0; font-size:28px;">🌟 Neuer Follower!</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#333;">Hallo <strong>{influencer_name}</strong>,</p>
                    <p style="font-size:16px; color:#555;">
                        Jemand hat sich mit Ihrem Influencer-Code registriert! 🎉
                    </p>
                    
                    <div style="background:#f0f0ff; border-radius:10px; padding:20px; margin:20px 0; text-align:center;">
                        <p style="margin:0; font-size:14px; color:#888;">Neues Mitglied:</p>
                        <p style="margin:10px 0 0; font-size:24px; color:#7C3AED; font-weight:bold;">{new_user_name}</p>
                    </div>
                    
                    <p style="font-size:14px; color:#555;">
                        Bei jedem Kauf dieses Kunden erhalten Sie automatisch Provision! 
                        Weiter so! 💪
                    </p>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://BidBlitz.ae/influencer-dashboard" 
                           style="display:inline-block; background:#7C3AED; color:#fff; padding:15px 30px; 
                                  text-decoration:none; border-radius:8px; font-weight:bold; font-size:16px;">
                            Dashboard ansehen →
                        </a>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=influencer_email,
        subject=f"🌟 Neuer Follower: {new_user_name} hat sich registriert!",
        html_content=html_content
    )

async def send_influencer_payout_confirmation(
    influencer_email: str,
    influencer_name: str,
    payout_amount: float,
    payment_method: str,
    payout_id: str
):
    """Send confirmation when influencer requests a payout."""
    method_text = "Banküberweisung" if payment_method == "bank_transfer" else "PayPal"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#10B981,#059669); padding:30px; text-align:center;">
                    <h1 style="color:#fff; margin:0; font-size:28px;">✓ Auszahlung beantragt</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#333;">Hallo <strong>{influencer_name}</strong>,</p>
                    <p style="font-size:16px; color:#555;">
                        Ihre Auszahlungsanfrage wurde erfolgreich eingereicht.
                    </p>
                    
                    <table width="100%" style="background:#f9f9f9; border-radius:10px; padding:20px; margin:20px 0;">
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Betrag:</p>
                            <p style="margin:5px 0 0; font-size:28px; color:#10B981; font-weight:bold;">€{payout_amount:.2f}</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Zahlungsmethode:</p>
                            <p style="margin:5px 0 0; font-size:18px; color:#333;">{method_text}</p>
                        </td></tr>
                        <tr><td style="padding:10px;">
                            <p style="margin:0; font-size:14px; color:#888;">Referenz-ID:</p>
                            <p style="margin:5px 0 0; font-size:14px; color:#888; font-family:monospace;">{payout_id}</p>
                        </td></tr>
                    </table>
                    
                    <div style="background:#FFF9E6; border-left:4px solid #F59E0B; padding:15px; margin:20px 0; border-radius:0 10px 10px 0;">
                        <p style="margin:0; font-size:14px; color:#555;">
                            <strong>Nächste Schritte:</strong><br>
                            Unser Team wird Ihre Anfrage innerhalb von 1-3 Werktagen bearbeiten.
                            Sie erhalten eine weitere Benachrichtigung, sobald die Zahlung veranlasst wurde.
                        </p>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=influencer_email,
        subject=f"✓ Auszahlung beantragt: €{payout_amount:.2f}",
        html_content=html_content
    )


async def send_admin_payout_notification(
    influencer_name: str,
    influencer_code: str,
    payout_amount: float,
    payment_method: str,
    payment_details: str,
    request_type: str = "influencer"  # "influencer" or "manager"
):
    """Send payout request notification to admin."""
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@BidBlitz.ae')
    
    type_label = "Influencer" if request_type == "influencer" else "Manager"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#7C3AED,#10B981); padding:30px; text-align:center;">
                    <h1 style="color:#fff; margin:0; font-size:24px;">💰 Neue Auszahlungsanfrage</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <div style="background:#F3F4F6; padding:20px; border-radius:10px; margin-bottom:20px;">
                        <p style="margin:0 0 10px 0; font-size:18px; font-weight:bold; color:#111;">
                            {type_label}: {influencer_name}
                        </p>
                        <p style="margin:0; font-size:14px; color:#666;">
                            Code: <strong>{influencer_code}</strong>
                        </p>
                    </div>
                    
                    <table width="100%" style="margin:20px 0;">
                        <tr>
                            <td style="padding:10px 0; border-bottom:1px solid #eee;">
                                <span style="color:#666;">Betrag:</span>
                            </td>
                            <td style="padding:10px 0; border-bottom:1px solid #eee; text-align:right;">
                                <strong style="color:#10B981; font-size:24px;">€{payout_amount:.2f}</strong>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:10px 0; border-bottom:1px solid #eee;">
                                <span style="color:#666;">Zahlungsmethode:</span>
                            </td>
                            <td style="padding:10px 0; border-bottom:1px solid #eee; text-align:right;">
                                <strong>{payment_method.upper()}</strong>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:10px 0;">
                                <span style="color:#666;">Details:</span>
                            </td>
                            <td style="padding:10px 0; text-align:right;">
                                <code style="background:#F3F4F6; padding:5px 10px; border-radius:5px;">{payment_details}</code>
                            </td>
                        </tr>
                    </table>
                    
                    <div style="background:#FEF3C7; border-left:4px solid #F59E0B; padding:15px; margin:20px 0; border-radius:0 10px 10px 0;">
                        <p style="margin:0; font-size:14px; color:#92400E;">
                            <strong>⚠️ Aktion erforderlich:</strong><br>
                            Bitte bearbeiten Sie diese Auszahlungsanfrage im Admin-Panel.
                        </p>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://BidBlitz.ae/admin-panel" style="display:inline-block; background:#7C3AED; color:#fff; padding:15px 30px; text-decoration:none; border-radius:10px; font-weight:bold;">
                            Zum Admin-Panel →
                        </a>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=ADMIN_EMAIL,
        subject=f"🔔 Neue Auszahlung: {influencer_name} - €{payout_amount:.2f}",
        html_content=html_content
    )


# ==================== WHOLESALE EMAIL NOTIFICATIONS ====================

async def send_wholesale_welcome_email(
    to_email: str,
    contact_name: str,
    company_name: str,
    discount_percent: float,
    credit_limit: float,
    payment_terms: str,
    has_user_account: bool = False
):
    """Send welcome email to newly approved wholesale customer."""
    
    # Payment terms translation
    payment_terms_text = {
        'prepaid': 'Vorkasse',
        'net15': 'Netto 15 Tage',
        'net30': 'Netto 30 Tage'
    }.get(payment_terms, payment_terms)
    
    # Credit limit display
    credit_display = f"€{credit_limit:,.0f}" if credit_limit > 0 else "Auf Anfrage"
    
    # Registration CTA if no account yet
    registration_section = ""
    if not has_user_account:
        registration_section = """
        <div style="background:linear-gradient(135deg,#06B6D4,#0891B2); padding:25px; border-radius:15px; margin:25px 0; text-align:center;">
            <h3 style="color:#fff; margin:0 0 10px 0; font-size:18px;">🚀 Jetzt registrieren & loslegen!</h3>
            <p style="color:#E0F2FE; margin:0 0 20px 0; font-size:14px;">
                Erstellen Sie Ihr Konto, um sofort von Ihren Großkundenvorteilen zu profitieren.
            </p>
            <a href="https://BidBlitz.ae/register" style="display:inline-block; background:#fff; color:#0891B2; padding:15px 40px; text-decoration:none; border-radius:10px; font-weight:bold; font-size:16px;">
                Kostenlos registrieren →
            </a>
        </div>
        <p style="font-size:13px; color:#64748B; text-align:center; margin-top:-10px;">
            Verwenden Sie bei der Registrierung diese E-Mail-Adresse: <strong>{email}</strong>
        </p>
        """.replace("{email}", to_email)
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:15px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
                <td style="background:linear-gradient(135deg,#1E293B,#334155); padding:40px 30px; text-align:center;">
                    <h1 style="color:#fff; margin:0; font-size:28px;">🏢 Willkommen als Großkunde!</h1>
                    <p style="color:#94A3B8; margin:10px 0 0; font-size:14px;">Ihre B2B-Partnerschaft mit BidBlitz.ae</p>
                </td>
            </tr>
            
            <!-- Content -->
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#1E293B;">Hallo <strong>{contact_name}</strong>,</p>
                    <p style="font-size:15px; color:#475569; line-height:1.6;">
                        Herzlich willkommen bei BidBlitz.ae! Wir freuen uns, <strong>{company_name}</strong> als Großkunden begrüßen zu dürfen. 
                        Ihre Bewerbung wurde genehmigt und Sie können ab sofort von exklusiven B2B-Vorteilen profitieren.
                    </p>
                    
                    <!-- Benefits Card -->
                    <div style="background:#F8FAFC; border-radius:15px; padding:25px; margin:25px 0; border:1px solid #E2E8F0;">
                        <h3 style="color:#1E293B; margin:0 0 20px 0; font-size:16px;">📋 Ihre Großkundenkonditionen</h3>
                        
                        <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="padding:12px 0; border-bottom:1px solid #E2E8F0;">
                                    <span style="color:#64748B; font-size:13px;">Dauerhafter Rabatt</span><br>
                                    <span style="color:#10B981; font-size:24px; font-weight:bold;">{discount_percent:.0f}%</span>
                                </td>
                                <td style="padding:12px 0; border-bottom:1px solid #E2E8F0; text-align:right;">
                                    <span style="color:#64748B; font-size:13px;">Auf alle Gebote-Pakete</span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:12px 0; border-bottom:1px solid #E2E8F0;">
                                    <span style="color:#64748B; font-size:13px;">Kreditlimit</span><br>
                                    <span style="color:#1E293B; font-size:18px; font-weight:bold;">{credit_display}</span>
                                </td>
                                <td style="padding:12px 0; border-bottom:1px solid #E2E8F0; text-align:right;">
                                    <span style="color:#64748B; font-size:13px;">Flexibler Einkaufsrahmen</span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:12px 0;">
                                    <span style="color:#64748B; font-size:13px;">Zahlungsziel</span><br>
                                    <span style="color:#1E293B; font-size:18px; font-weight:bold;">{payment_terms_text}</span>
                                </td>
                                <td style="padding:12px 0; text-align:right;">
                                    <span style="color:#64748B; font-size:13px;">Bequeme Abrechnung</span>
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    {registration_section}
                    
                    <!-- Benefits List -->
                    <div style="margin:25px 0;">
                        <h3 style="color:#1E293B; margin:0 0 15px 0; font-size:16px;">✨ Ihre exklusiven Vorteile</h3>
                        <table cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="padding:8px 15px 8px 0; vertical-align:top;">✅</td>
                                <td style="padding:8px 0; color:#475569; font-size:14px;">Dauerhafter Rabatt auf alle Gebote-Pakete</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 15px 8px 0; vertical-align:top;">✅</td>
                                <td style="padding:8px 0; color:#475569; font-size:14px;">Prioritärer Kundensupport</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 15px 8px 0; vertical-align:top;">✅</td>
                                <td style="padding:8px 0; color:#475569; font-size:14px;">Monatliche Sammelrechnung</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 15px 8px 0; vertical-align:top;">✅</td>
                                <td style="padding:8px 0; color:#475569; font-size:14px;">Dedizierter Account Manager</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 15px 8px 0; vertical-align:top;">✅</td>
                                <td style="padding:8px 0; color:#475569; font-size:14px;">Exklusive B2B-Angebote und Aktionen</td>
                            </tr>
                        </table>
                    </div>
                    
                    <!-- Contact -->
                    <div style="background:#EFF6FF; border-radius:10px; padding:20px; margin-top:25px; text-align:center;">
                        <p style="margin:0; color:#1E40AF; font-size:14px;">
                            <strong>Fragen?</strong> Unser B2B-Team steht Ihnen gerne zur Verfügung:<br>
                            📧 b2b@BidBlitz.ae | 📞 +49 123 456 7890
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background:#F8FAFC; padding:20px 30px; text-align:center; border-top:1px solid #E2E8F0;">
                    <p style="margin:0; color:#64748B; font-size:12px;">
                        © 2026 BidBlitz.ae GmbH | Ihr Partner für Penny-Auktionen
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"🏢 Willkommen bei BidBlitz.ae, {company_name}! Ihre Großkundenvorteile sind aktiviert",
        html_content=html_content
    )



# ==================== ABANDONED CART EMAIL ====================

async def send_abandoned_cart_reminder(
    to_email: str,
    user_name: str,
    cart_items: list,
    cart_total: float,
    discount_code: str = "COMEBACK10"
):
    """Send reminder email for abandoned cart with optional discount."""
    
    # Build items list HTML
    items_html = ""
    for item in cart_items[:3]:  # Show max 3 items
        items_html += f"""
        <tr>
            <td style="padding:10px; border-bottom:1px solid #eee;">
                {item.get('product_type', 'Gebote-Paket').replace('_', ' ').title()}
            </td>
            <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">
                €{item.get('price', 0):.2f}
            </td>
        </tr>
        """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#F59E0B,#D97706); padding:30px; text-align:center;">
                    <h1 style="color:#fff; margin:0; font-size:28px;">🛒 Sie haben etwas vergessen!</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#333;">Hallo <strong>{user_name}</strong>,</p>
                    <p style="font-size:16px; color:#555;">
                        Sie haben Artikel in Ihrem Warenkorb gelassen. Schließen Sie Ihren Kauf ab, 
                        bevor sie weg sind!
                    </p>
                    
                    <table width="100%" style="margin:20px 0; border-collapse:collapse;">
                        <tr style="background:#f9f9f9;">
                            <td style="padding:10px; font-weight:bold;">Artikel</td>
                            <td style="padding:10px; text-align:right; font-weight:bold;">Preis</td>
                        </tr>
                        {items_html}
                        <tr>
                            <td style="padding:15px 10px; font-weight:bold; font-size:18px;">Gesamt:</td>
                            <td style="padding:15px 10px; text-align:right; font-weight:bold; font-size:18px; color:#F59E0B;">
                                €{cart_total:.2f}
                            </td>
                        </tr>
                    </table>
                    
                    <div style="background:#FEF3C7; border:2px dashed #F59E0B; border-radius:10px; padding:20px; margin:20px 0; text-align:center;">
                        <p style="margin:0; font-size:14px; color:#92400E;">🎁 Exklusiv für Sie:</p>
                        <p style="margin:10px 0 0; font-size:28px; color:#D97706; font-weight:bold; letter-spacing:3px;">{discount_code}</p>
                        <p style="margin:10px 0 0; font-size:14px; color:#92400E;">10% Rabatt auf Ihren nächsten Einkauf!</p>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px;">
                        <a href="https://BidBlitz.ae/buy-bids" 
                           style="display:inline-block; background:linear-gradient(135deg,#F59E0B,#D97706); 
                                  color:#fff; padding:18px 40px; text-decoration:none; border-radius:10px; 
                                  font-weight:bold; font-size:18px; box-shadow:0 4px 15px rgba(245,158,11,0.4);">
                            Jetzt Einkauf abschließen →
                        </a>
                    </div>
                    
                    <p style="font-size:12px; color:#888; margin-top:30px; text-align:center;">
                        Der Rabattcode ist 7 Tage gültig. Falls Sie Fragen haben, 
                        <a href="mailto:support@bidblitz.ae" style="color:#F59E0B;">kontaktieren Sie uns</a>.
                    </p>
                </td>
            </tr>
            <tr>
                <td style="background:#1a1a1a; padding:20px; text-align:center;">
                    <p style="margin:0; color:#888; font-size:12px;">
                        © 2026 BidBlitz.ae FZCO | Dubai, UAE
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return await send_email(
        to_email=to_email,
        subject=f"🛒 {user_name}, Sie haben Artikel im Warenkorb vergessen!",
        html_content=html_content
    )
