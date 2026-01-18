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
