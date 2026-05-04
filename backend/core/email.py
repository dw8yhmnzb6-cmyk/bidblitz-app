"""
BidBlitz V2 - Email Notification Service
Handles all transactional emails: password reset, payments, receipts, KYC
"""

import os
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger("bidblitz.email")

# Try to import resend, fallback to logging if not configured
try:
    import resend
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
    if RESEND_API_KEY:
        resend.api_key = RESEND_API_KEY
        EMAIL_ENABLED = True
    else:
        EMAIL_ENABLED = False
        logger.warning("RESEND_API_KEY not set - emails will be logged only")
except ImportError:
    EMAIL_ENABLED = False
    logger.warning("Resend not installed - emails will be logged only")

FROM_EMAIL = os.environ.get("FROM_EMAIL", "BidBlitz <noreply@bidblitz.com>")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://bidblitz.com")


def send_email(to: str, subject: str, html: str) -> bool:
    """Send email via Resend or log if not configured.

    Returns True on success or when Resend is disabled (logged-only).
    Returns False if Resend is enabled but rejected the message.
    """
    if not EMAIL_ENABLED:
        logger.info(f"[EMAIL LOG] To: {to}, Subject: {subject}")
        logger.debug(f"[EMAIL CONTENT] {html[:200]}...")
        return True

    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


def send_email_detailed(to: str, subject: str, html: str) -> dict:
    """Same as send_email() but returns a structured result with reason on failure.

    Returns dict: {sent: bool, reason: str, resend_enabled: bool, error?: str}
    Reasons: 'sent' | 'logged_only' | 'rejected'
    """
    if not EMAIL_ENABLED:
        logger.info(f"[EMAIL LOG] To: {to}, Subject: {subject}")
        return {"sent": True, "reason": "logged_only", "resend_enabled": False}

    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Email sent to {to}: {subject}")
        return {"sent": True, "reason": "sent", "resend_enabled": True}
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Failed to send email to {to}: {err_msg}")
        return {
            "sent": False,
            "reason": "rejected",
            "resend_enabled": True,
            "error": err_msg[:300],
        }


# ═══════════════════════════════════════════════════
# EMAIL TEMPLATES
# ═══════════════════════════════════════════════════

def get_base_template(content: str, title: str) -> str:
    """Wrap content in BidBlitz email template."""
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#050505;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#050505;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" style="max-width:500px;background-color:#0A0A0A;border-radius:16px;border:1px solid #1A1A1A;">
                    <!-- Header -->
                    <tr>
                        <td style="padding:30px 30px 20px;text-align:center;">
                            <div style="width:50px;height:50px;background:linear-gradient(135deg,#00C2FF,#0090FF);border-radius:12px;display:inline-block;line-height:50px;">
                                <span style="color:#fff;font-weight:bold;font-size:18px;">BB</span>
                            </div>
                            <h1 style="color:#fff;font-size:22px;margin:15px 0 5px;font-weight:600;">BidBlitz</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding:0 30px 30px;">
                            {content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding:20px 30px;border-top:1px solid #1A1A1A;text-align:center;">
                            <p style="color:#666;font-size:12px;margin:0;">
                                © 2026 BidBlitz. Alle Rechte vorbehalten.
                            </p>
                            <p style="color:#444;font-size:11px;margin:10px 0 0;">
                                Diese E-Mail wurde automatisch generiert.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


# ═══════════════════════════════════════════════════
# PASSWORD RESET EMAIL
# ═══════════════════════════════════════════════════

def send_password_reset_email(to: str, reset_token: str, user_name: str = "") -> bool:
    """Send password reset email with token link."""
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    content = f"""
        <h2 style="color:#fff;font-size:18px;margin:0 0 15px;">Passwort zurücksetzen</h2>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;">
            {"Hallo " + user_name + "," if user_name else "Hallo,"}
        </p>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 25px;">
            Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. 
            Klicke auf den Button unten, um ein neues Passwort zu erstellen.
        </p>
        <a href="{reset_url}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00C2FF,#0090FF);color:#000;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">
            Passwort zurücksetzen
        </a>
        <p style="color:#666;font-size:12px;margin:25px 0 0;">
            Dieser Link ist 1 Stunde gültig. Falls du diese Anfrage nicht gestellt hast, 
            kannst du diese E-Mail ignorieren.
        </p>
    """
    
    html = get_base_template(content, "Passwort zurücksetzen - BidBlitz")
    return send_email(to, "Passwort zurücksetzen - BidBlitz", html)


# ═══════════════════════════════════════════════════
# PAYMENT CONFIRMATION EMAIL
# ═══════════════════════════════════════════════════

def send_payment_confirmation_email(
    to: str,
    amount: float,
    payment_type: str,
    reference: str,
    user_name: str = ""
) -> bool:
    """Send payment confirmation email."""
    
    type_labels = {
        "topup": "Wallet-Aufladung",
        "purchase": "Kauf",
        "mining_purchase": "Mining-Paket",
        "auction_credits": "Auktions-Credits",
        "subscription": "Abonnement",
    }
    type_label = type_labels.get(payment_type, "Zahlung")
    
    content = f"""
        <h2 style="color:#fff;font-size:18px;margin:0 0 15px;">Zahlung bestätigt</h2>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;">
            {"Hallo " + user_name + "," if user_name else "Hallo,"}
        </p>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 25px;">
            Deine {type_label} wurde erfolgreich verarbeitet.
        </p>
        <div style="background:#111;border-radius:12px;padding:20px;margin:0 0 25px;">
            <table width="100%" style="border-collapse:collapse;">
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Betrag</td>
                    <td style="color:#00D26A;font-size:18px;font-weight:bold;text-align:right;">€{amount:.2f}</td>
                </tr>
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Typ</td>
                    <td style="color:#fff;font-size:14px;text-align:right;">{type_label}</td>
                </tr>
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Referenz</td>
                    <td style="color:#00C2FF;font-size:12px;text-align:right;font-family:monospace;">{reference}</td>
                </tr>
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Datum</td>
                    <td style="color:#fff;font-size:14px;text-align:right;">{datetime.now().strftime("%d.%m.%Y %H:%M")}</td>
                </tr>
            </table>
        </div>
        <a href="{FRONTEND_URL}/wallet" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00C2FF,#0090FF);color:#000;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">
            Zum Wallet
        </a>
    """
    
    html = get_base_template(content, "Zahlung bestätigt - BidBlitz")
    return send_email(to, f"Zahlung bestätigt: €{amount:.2f} - BidBlitz", html)


# ═══════════════════════════════════════════════════
# RECEIPT EMAIL
# ═══════════════════════════════════════════════════

def send_receipt_email(
    to: str,
    transaction_id: str,
    amount: float,
    fee: float,
    net_amount: float,
    description: str,
    merchant_name: str = "",
    user_name: str = ""
) -> bool:
    """Send transaction receipt email."""
    
    receipt_url = f"{FRONTEND_URL}/wallet?receipt={transaction_id}"
    
    content = f"""
        <h2 style="color:#fff;font-size:18px;margin:0 0 15px;">Deine Quittung</h2>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;">
            {"Hallo " + user_name + "," if user_name else "Hallo,"}
        </p>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 25px;">
            Hier ist die Quittung für deine Transaktion.
        </p>
        <div style="background:#111;border-radius:12px;padding:20px;margin:0 0 25px;">
            <table width="100%" style="border-collapse:collapse;">
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Beschreibung</td>
                    <td style="color:#fff;font-size:14px;text-align:right;">{description}</td>
                </tr>
                {"<tr><td style='color:#666;font-size:13px;padding:8px 0;'>Händler</td><td style='color:#fff;font-size:14px;text-align:right;'>" + merchant_name + "</td></tr>" if merchant_name else ""}
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Betrag</td>
                    <td style="color:#fff;font-size:14px;text-align:right;">€{amount:.2f}</td>
                </tr>
                {"<tr><td style='color:#666;font-size:13px;padding:8px 0;'>Gebühr</td><td style='color:#FFB800;font-size:14px;text-align:right;'>€" + f"{fee:.2f}" + "</td></tr>" if fee > 0 else ""}
                <tr style="border-top:1px solid #222;">
                    <td style="color:#888;font-size:14px;padding:12px 0 8px;font-weight:bold;">Gesamt</td>
                    <td style="color:#00D26A;font-size:20px;font-weight:bold;text-align:right;">€{net_amount:.2f}</td>
                </tr>
                <tr>
                    <td style="color:#666;font-size:11px;padding:8px 0;">Transaktions-ID</td>
                    <td style="color:#00C2FF;font-size:11px;text-align:right;font-family:monospace;">{transaction_id}</td>
                </tr>
                <tr>
                    <td style="color:#666;font-size:11px;padding:4px 0;">Datum</td>
                    <td style="color:#888;font-size:11px;text-align:right;">{datetime.now().strftime("%d.%m.%Y %H:%M:%S")}</td>
                </tr>
            </table>
        </div>
        <a href="{receipt_url}" style="display:inline-block;padding:14px 32px;background:#1A1A1A;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;border:1px solid #333;">
            PDF herunterladen
        </a>
    """
    
    html = get_base_template(content, "Quittung - BidBlitz")
    return send_email(to, f"Quittung #{transaction_id[:8]} - BidBlitz", html)


# ═══════════════════════════════════════════════════
# KYC STATUS EMAIL
# ═══════════════════════════════════════════════════

def send_kyc_status_email(
    to: str,
    status: str,
    user_name: str = "",
    rejection_reason: str = ""
) -> bool:
    """Send KYC verification status update email."""
    
    if status == "approved":
        status_color = "#00D26A"
        status_text = "Verifizierung erfolgreich"
        status_icon = "✓"
        message = """
            Deine Identität wurde erfolgreich verifiziert. Du hast jetzt vollen Zugriff 
            auf alle BidBlitz-Funktionen, einschließlich höherer Transaktionslimits.
        """
        cta_text = "Jetzt starten"
        cta_url = f"{FRONTEND_URL}/wallet"
    elif status == "rejected":
        status_color = "#FF4757"
        status_text = "Verifizierung abgelehnt"
        status_icon = "✗"
        message = f"""
            Leider konnten wir deine Identität nicht verifizieren.
            {f"<br><br><strong>Grund:</strong> {rejection_reason}" if rejection_reason else ""}
            <br><br>Bitte lade neue Dokumente hoch oder kontaktiere unseren Support.
        """
        cta_text = "Erneut versuchen"
        cta_url = f"{FRONTEND_URL}/settings/verification"
    else:  # pending
        status_color = "#FFB800"
        status_text = "Verifizierung in Bearbeitung"
        status_icon = "⏳"
        message = """
            Wir haben deine Dokumente erhalten und prüfen sie derzeit. 
            Du erhältst eine weitere E-Mail, sobald die Prüfung abgeschlossen ist.
            Dies dauert in der Regel 1-2 Werktage.
        """
        cta_text = "Status prüfen"
        cta_url = f"{FRONTEND_URL}/settings/verification"
    
    content = f"""
        <div style="text-align:center;margin:0 0 25px;">
            <div style="width:60px;height:60px;background:{status_color}20;border-radius:50%;display:inline-block;line-height:60px;font-size:28px;">
                {status_icon}
            </div>
        </div>
        <h2 style="color:#fff;font-size:18px;margin:0 0 15px;text-align:center;">{status_text}</h2>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;">
            {"Hallo " + user_name + "," if user_name else "Hallo,"}
        </p>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 25px;">
            {message}
        </p>
        <div style="text-align:center;">
            <a href="{cta_url}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00C2FF,#0090FF);color:#000;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">
                {cta_text}
            </a>
        </div>
    """
    
    html = get_base_template(content, f"{status_text} - BidBlitz")
    return send_email(to, f"{status_text} - BidBlitz", html)


# ═══════════════════════════════════════════════════
# WELCOME EMAIL
# ═══════════════════════════════════════════════════

def send_welcome_email(to: str, user_name: str = "") -> bool:
    """Send welcome email after registration."""
    
    content = f"""
        <h2 style="color:#fff;font-size:18px;margin:0 0 15px;">Willkommen bei BidBlitz!</h2>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;">
            {"Hallo " + user_name + "," if user_name else "Hallo,"}
        </p>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 25px;">
            Vielen Dank für deine Registrierung! Dein Konto ist jetzt aktiv und bereit.
        </p>
        <div style="background:#111;border-radius:12px;padding:20px;margin:0 0 25px;">
            <p style="color:#fff;font-size:14px;margin:0 0 15px;font-weight:600;">Was du jetzt tun kannst:</p>
            <ul style="color:#AAA;font-size:13px;line-height:1.8;margin:0;padding-left:20px;">
                <li>Wallet aufladen und sofort bezahlen</li>
                <li>An spannenden Auktionen teilnehmen</li>
                <li>Mining-Pakete kaufen und BLZ verdienen</li>
                <li>Freunde einladen und Belohnungen erhalten</li>
            </ul>
        </div>
        <a href="{FRONTEND_URL}/wallet" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00C2FF,#0090FF);color:#000;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">
            Jetzt loslegen
        </a>
    """
    
    html = get_base_template(content, "Willkommen bei BidBlitz!")
    return send_email(to, "Willkommen bei BidBlitz! 🎉", html)


# ═══════════════════════════════════════════════════
# OTP EMAIL (for 2FA)
# ═══════════════════════════════════════════════════

def send_otp_email(to: str, otp_code: str, purpose: str = "Verifizierung", user_name: str = "") -> bool:
    """Send OTP code for 2FA or verification."""
    
    purpose_labels = {
        "login": "Login-Bestätigung",
        "enable_2fa": "2FA-Aktivierung",
        "disable_2fa": "2FA-Deaktivierung",
        "verification": "Verifizierung",
    }
    purpose_label = purpose_labels.get(purpose, purpose)
    
    content = f"""
        <h2 style="color:#fff;font-size:18px;margin:0 0 15px;">Dein Bestätigungscode</h2>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;">
            {"Hallo " + user_name + "," if user_name else "Hallo,"}
        </p>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 25px;">
            Dein Einmal-Code für die {purpose_label}:
        </p>
        <div style="background:#111;border-radius:16px;padding:30px;margin:0 0 25px;text-align:center;">
            <span style="font-size:36px;font-weight:900;color:#00C2FF;font-family:monospace;letter-spacing:8px;">{otp_code}</span>
        </div>
        <p style="color:#666;font-size:12px;text-align:center;margin:0;">
            Dieser Code ist <strong>10 Minuten</strong> gültig.<br>
            Teile diesen Code mit niemandem.
        </p>
    """
    
    html = get_base_template(content, f"{purpose_label} - BidBlitz")
    return send_email(to, f"BidBlitz Code: {otp_code}", html)


# ═══════════════════════════════════════════════════
# TOP-UP CONFIRMATION EMAIL
# ═══════════════════════════════════════════════════

def send_topup_confirmation_email(to: str, amount: float, new_balance: float, user_name: str = "") -> bool:
    """Send confirmation after wallet top-up."""
    
    content = f"""
        <div style="text-align:center;margin:0 0 25px;">
            <div style="width:60px;height:60px;background:#00D26A20;border-radius:50%;display:inline-block;line-height:60px;font-size:28px;">
                ✓
            </div>
        </div>
        <h2 style="color:#00D26A;font-size:18px;margin:0 0 15px;text-align:center;">Wallet aufgeladen!</h2>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;">
            {"Hallo " + user_name + "," if user_name else "Hallo,"}
        </p>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 25px;">
            Dein Guthaben wurde erfolgreich aufgeladen.
        </p>
        <div style="background:#111;border-radius:12px;padding:20px;margin:0 0 25px;">
            <table width="100%" style="border-collapse:collapse;">
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Aufgeladen</td>
                    <td style="color:#00D26A;font-size:18px;font-weight:bold;text-align:right;">+€{amount:.2f}</td>
                </tr>
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Neues Guthaben</td>
                    <td style="color:#00C2FF;font-size:18px;font-weight:bold;text-align:right;">€{new_balance:.2f}</td>
                </tr>
            </table>
        </div>
        <div style="text-align:center;">
            <a href="{FRONTEND_URL}/wallet" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00C2FF,#0090FF);color:#000;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">
                Zum Wallet
            </a>
        </div>
    """
    
    html = get_base_template(content, "Wallet aufgeladen - BidBlitz")
    return send_email(to, f"Wallet aufgeladen: +€{amount:.2f}", html)


def send_transfer_notification(to: str, sender_name: str, title: str, message: str, 
                                file_count: int, total_size: str, share_url: str, expires_days: int) -> bool:
    """Send BlitzTransfer notification email to recipient."""
    
    content = f"""
        <div style="text-align:center;margin:0 0 25px;">
            <div style="width:60px;height:60px;background:#00C2FF20;border-radius:50%;display:inline-block;line-height:60px;font-size:28px;">
                📦
            </div>
        </div>
        <h2 style="color:#00C2FF;font-size:18px;margin:0 0 15px;text-align:center;">{title}</h2>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;">
            <strong>{sender_name}</strong> hat dir {file_count} Datei(en) ({total_size}) per BlitzTransfer gesendet.
        </p>
        {f'<p style="color:#888;font-size:13px;line-height:1.5;margin:0 0 20px;background:#111;padding:15px;border-radius:8px;font-style:italic;">"{message}"</p>' if message else ''}
        <div style="background:#111;border-radius:12px;padding:20px;margin:0 0 25px;">
            <table width="100%" style="border-collapse:collapse;">
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Dateien</td>
                    <td style="color:#fff;font-size:14px;font-weight:600;text-align:right;">{file_count}</td>
                </tr>
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Größe</td>
                    <td style="color:#fff;font-size:14px;font-weight:600;text-align:right;">{total_size}</td>
                </tr>
                <tr>
                    <td style="color:#666;font-size:13px;padding:8px 0;">Gültig für</td>
                    <td style="color:#FFB800;font-size:14px;font-weight:600;text-align:right;">{expires_days} Tage</td>
                </tr>
            </table>
        </div>
        <div style="text-align:center;">
            <a href="{share_url}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00C2FF,#0090FF);color:#000;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">
                Dateien herunterladen
            </a>
        </div>
        <p style="color:#666;font-size:12px;line-height:1.5;margin:25px 0 0;text-align:center;">
            Link: <a href="{share_url}" style="color:#00C2FF;text-decoration:none;">{share_url[:60]}...</a>
        </p>
    """
    
    html = get_base_template(content, f"Transfer von {sender_name} - BidBlitz")
    return send_email(to, f"📦 {sender_name} hat dir {file_count} Datei(en) gesendet", html)
