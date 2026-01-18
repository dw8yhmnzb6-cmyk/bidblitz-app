"""Security utilities - Password validation, 2FA, VPN checking"""
import re
import uuid
import base64
import io
import logging
from datetime import datetime, timezone, timedelta
import pyotp
import qrcode
from .database import db

logger = logging.getLogger(__name__)

def validate_password_strength(password: str) -> tuple:
    """Validate password meets security requirements"""
    if len(password) < 8:
        return False, "Passwort muss mindestens 8 Zeichen lang sein"
    if len(password) > 128:
        return False, "Passwort darf maximal 128 Zeichen lang sein"
    if not re.search(r'[A-Z]', password):
        return False, "Passwort muss mindestens einen Großbuchstaben enthalten"
    if not re.search(r'[a-z]', password):
        return False, "Passwort muss mindestens einen Kleinbuchstaben enthalten"
    if not re.search(r'\d', password):
        return False, "Passwort muss mindestens eine Zahl enthalten"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/]', password):
        return False, "Passwort muss mindestens ein Sonderzeichen enthalten (!@#$%^&*)"
    
    weak_passwords = ['password', 'passwort', '12345678', 'qwertyui', 'admin123', 'letmein', 'welcome']
    if password.lower() in weak_passwords or any(wp in password.lower() for wp in weak_passwords):
        return False, "Passwort ist zu schwach. Bitte wählen Sie ein sichereres Passwort"
    
    return True, "OK"

async def log_security_event(event_type: str, user_id: str, details: dict, ip_address: str = None):
    """Log security events to database"""
    event = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "user_id": user_id,
        "details": details,
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_agent": details.get("user_agent", "unknown")
    }
    await db.security_logs.insert_one(event)
    logger.info(f"Security event: {event_type} for user {user_id} from IP {ip_address}")
    return event

async def check_login_attempts(ip_address: str, email: str) -> tuple:
    """Check if too many failed login attempts"""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    
    failed_attempts = await db.security_logs.count_documents({
        "event_type": "login_failed",
        "$or": [
            {"ip_address": ip_address},
            {"details.email": email}
        ],
        "timestamp": {"$gte": cutoff}
    })
    
    if failed_attempts >= 5:
        return False, 15 - int((datetime.now(timezone.utc) - datetime.fromisoformat(cutoff.replace("Z", "+00:00"))).total_seconds() / 60)
    
    return True, 0

async def check_vpn_proxy(ip_address: str) -> dict:
    """Check if IP is a VPN, proxy, or datacenter IP"""
    if not ip_address or ip_address in ["unknown", "127.0.0.1", "localhost"]:
        return {"is_vpn": False, "is_proxy": False, "is_datacenter": False}
    
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"http://ip-api.com/json/{ip_address}?fields=status,proxy,hosting")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    is_proxy = data.get("proxy", False)
                    is_hosting = data.get("hosting", False)
                    return {
                        "is_vpn": is_hosting,
                        "is_proxy": is_proxy,
                        "is_datacenter": is_hosting
                    }
    except Exception as e:
        logger.warning(f"VPN check failed for {ip_address}: {e}")
    
    return {"is_vpn": False, "is_proxy": False, "is_datacenter": False}

def generate_2fa_secret() -> str:
    """Generate a new TOTP secret"""
    return pyotp.random_base32()

def generate_2fa_qr_code(email: str, secret: str) -> str:
    """Generate QR code for 2FA setup"""
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(email, issuer_name="BidBlitz")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_base64}"

def verify_2fa_code(secret: str, code: str) -> bool:
    """Verify a TOTP code"""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
