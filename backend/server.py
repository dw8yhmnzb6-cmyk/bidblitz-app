from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import json
import random
import re
import base64
import io
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import resend
import pyotp
import qrcode
from coinbase_commerce.client import Client as CoinbaseClient
from coinbase_commerce.error import CoinbaseError
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
)
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from fastapi.responses import StreamingResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'bidblitz_secret')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Email Config (Resend)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Stripe Config
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Coinbase Commerce Config
COINBASE_COMMERCE_API_KEY = os.environ.get('COINBASE_COMMERCE_API_KEY', '')
coinbase_client = None
if COINBASE_COMMERCE_API_KEY:
    coinbase_client = CoinbaseClient(api_key=COINBASE_COMMERCE_API_KEY)

# Create the main app
app = FastAPI(title="BidBlitz Auction API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== WEBSOCKET CONNECTION MANAGER ====================

class ConnectionManager:
    """Manages WebSocket connections for real-time auction updates"""
    
    def __init__(self):
        # Dict mapping auction_id to set of WebSocket connections
        self.auction_connections: Dict[str, Set[WebSocket]] = {}
        # Dict mapping WebSocket to user info
        self.connection_info: Dict[WebSocket, Dict] = {}
    
    async def connect(self, websocket: WebSocket, auction_id: str, user_info: Optional[Dict] = None):
        """Accept and store a new WebSocket connection"""
        await websocket.accept()
        
        if auction_id not in self.auction_connections:
            self.auction_connections[auction_id] = set()
        
        self.auction_connections[auction_id].add(websocket)
        self.connection_info[websocket] = {
            "auction_id": auction_id,
            "user_info": user_info,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        
        logger.info(f"WebSocket connected to auction {auction_id}. Total connections: {len(self.auction_connections[auction_id])}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        info = self.connection_info.get(websocket, {})
        auction_id = info.get("auction_id")
        
        if auction_id and auction_id in self.auction_connections:
            self.auction_connections[auction_id].discard(websocket)
            if not self.auction_connections[auction_id]:
                del self.auction_connections[auction_id]
        
        if websocket in self.connection_info:
            del self.connection_info[websocket]
        
        logger.info(f"WebSocket disconnected from auction {auction_id}")
    
    async def broadcast_to_auction(self, auction_id: str, message: Dict):
        """Broadcast a message to all connections for a specific auction"""
        if auction_id not in self.auction_connections:
            return
        
        disconnected = set()
        for websocket in self.auction_connections[auction_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send message: {e}")
                disconnected.add(websocket)
        
        # Clean up disconnected sockets
        for ws in disconnected:
            self.disconnect(ws)
    
    async def broadcast_to_all(self, message: Dict):
        """Broadcast a message to all connected clients"""
        for auction_id in list(self.auction_connections.keys()):
            await self.broadcast_to_auction(auction_id, message)
    
    def get_connection_count(self, auction_id: str = None) -> int:
        """Get number of active connections"""
        if auction_id:
            return len(self.auction_connections.get(auction_id, set()))
        return sum(len(conns) for conns in self.auction_connections.values())

# Global WebSocket manager instance
ws_manager = ConnectionManager()

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    source: Optional[str] = None  # Where user came from (google, facebook, direct, etc.)
    referral_code: Optional[str] = None  # Affiliate referral code

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    two_factor_code: Optional[str] = None  # 6-digit TOTP code

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    bids_balance: int
    is_admin: bool
    created_at: str
    two_factor_enabled: bool = False

class ProductCreate(BaseModel):
    name: str
    description: str
    image_url: str
    retail_price: float
    category: str

class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    image_url: str
    retail_price: float
    category: str
    created_at: str

class AuctionCreate(BaseModel):
    product_id: str
    starting_price: float
    bid_increment: float
    duration_seconds: Optional[int] = None  # Optional if start_time and end_time are provided
    start_time: Optional[str] = None  # ISO datetime string for scheduled start
    end_time: Optional[str] = None  # ISO datetime string for scheduled end
    bot_target_price: Optional[float] = None  # Price up to which bots will bid in last seconds

class AuctionResponse(BaseModel):
    id: str
    product_id: str
    product: Optional[Dict[str, Any]] = None
    current_price: float
    bid_increment: float
    start_time: Optional[str] = None
    end_time: str
    status: str
    winner_id: Optional[str] = None
    winner_name: Optional[str] = None
    total_bids: int
    last_bidder_id: Optional[str] = None
    last_bidder_name: Optional[str] = None
    created_at: str
    bot_target_price: Optional[float] = None

class BidRequest(BaseModel):
    auction_id: str

class BidPackage(BaseModel):
    id: str
    name: str
    bids: int
    price: float
    popular: bool = False

class CheckoutRequest(BaseModel):
    package_id: str
    origin_url: str

# Password Reset Models
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# ==================== NEW FEATURE MODELS ====================

class BuyNowRequest(BaseModel):
    auction_id: str

class WishlistRequest(BaseModel):
    product_id: Optional[str] = None
    category: Optional[str] = None

class AchievementType:
    FIRST_WIN = "first_win"
    WINS_10 = "wins_10"
    WINS_50 = "wins_50"
    NIGHT_OWL = "night_owl"
    EARLY_BIRD = "early_bird"
    BIG_SPENDER = "big_spender"
    STREAK_7 = "streak_7"
    STREAK_30 = "streak_30"
    SOCIAL_SHARER = "social_sharer"

class VIPSubscription(BaseModel):
    plan: str  # monthly, yearly
    
class ChatMessage(BaseModel):
    message: str
    auction_id: Optional[str] = None

class VoucherCreate(BaseModel):
    code: str
    bids: int
    max_uses: int = 1
    expires_at: Optional[str] = None  # ISO datetime string

class VoucherRedeem(BaseModel):
    code: str

class AutobidderCreate(BaseModel):
    auction_id: str
    max_price: float  # Maximum price the user is willing to pay

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    retail_price: Optional[float] = None
    category: Optional[str] = None

class AuctionUpdate(BaseModel):
    duration_seconds: Optional[int] = None  # Extend auction time
    status: Optional[str] = None
    start_time: Optional[str] = None  # ISO datetime string
    end_time: Optional[str] = None  # ISO datetime string

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    bids_balance: Optional[int] = None

# Affiliate Models
class AffiliateRegister(BaseModel):
    name: str
    email: EmailStr
    payment_method: str = "bank_transfer"  # bank_transfer, paypal
    payment_details: str  # IBAN or PayPal email

class AffiliateStats(BaseModel):
    total_referrals: int
    converted_leads: int  # Users who bought a package
    pending_commission: float
    paid_commission: float
    current_tier: str
    commission_rate: float

# Admin Bot Models
class BotCreate(BaseModel):
    name: str  # Bot display name (e.g., "Maria K.", "Thomas M.")
    
class BotBidRequest(BaseModel):
    auction_id: str
    bot_id: str
    target_price: Optional[float] = None  # Target price to reach
    num_bids: Optional[int] = None  # Number of bids to place
    delay_seconds: Optional[int] = 2  # Delay between bids

class MultiBotBidRequest(BaseModel):
    auction_id: str
    target_price: float  # Price up to which bots will bid
    min_delay: Optional[float] = 1.0  # Minimum seconds between bids

# Email Marketing Models
class EmailCampaignCreate(BaseModel):
    subject: str
    html_content: str
    target_group: str = "all"  # all, active, inactive, winners, new_users
    
class EmailTestSend(BaseModel):
    to_email: str
    subject: str
    html_content: str

# Crypto Payment Models
class CryptoCheckoutRequest(BaseModel):
    package_id: str
    bids: int
    price: float

# ==================== SECURITY FUNCTIONS ====================

def validate_password_strength(password: str) -> tuple[bool, str]:
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
    
    # Check for common weak passwords
    weak_passwords = ['password', 'passwort', '12345678', 'qwertyui', 'admin123', 'letmein', 'welcome']
    if password.lower() in weak_passwords or any(wp in password.lower() for wp in weak_passwords):
        return False, "Passwort ist zu schwach. Bitte wählen Sie ein sichereres Passwort"
    
    return True, "OK"

async def log_security_event(event_type: str, user_id: str, details: dict, ip_address: str = None):
    """Log security events to database"""
    event = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,  # login, login_failed, password_change, 2fa_enabled, etc.
        "user_id": user_id,
        "details": details,
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_agent": details.get("user_agent", "unknown")
    }
    await db.security_logs.insert_one(event)
    logger.info(f"Security event: {event_type} for user {user_id} from IP {ip_address}")
    return event

async def check_login_attempts(ip_address: str, email: str) -> tuple[bool, int]:
    """Check if too many failed login attempts"""
    # Check last 15 minutes
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    
    failed_attempts = await db.security_logs.count_documents({
        "event_type": "login_failed",
        "$or": [
            {"ip_address": ip_address},
            {"details.email": email}
        ],
        "timestamp": {"$gte": cutoff}
    })
    
    # Allow max 5 attempts per 15 minutes
    if failed_attempts >= 5:
        return False, 15 - int((datetime.now(timezone.utc) - datetime.fromisoformat(cutoff.replace("Z", "+00:00"))).total_seconds() / 60)
    
    return True, 0

def generate_2fa_secret() -> str:
    """Generate a new TOTP secret"""
    return pyotp.random_base32()

def generate_2fa_qr_code(email: str, secret: str) -> str:
    """Generate QR code for 2FA setup"""
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(email, issuer_name="BidBlitz")
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_base64}"

def verify_2fa_code(secret: str, code: str) -> bool:
    """Verify a TOTP code"""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)  # Allow 30 seconds tolerance
    max_delay: Optional[float] = 5.0  # Maximum seconds between bids

# Fixed bid packages (server-side only) - €0.50 per bid
BID_PACKAGES = {
    "pack_5": BidPackage(id="pack_5", name="5 € Paket", bids=10, price=5.00),
    "pack_10": BidPackage(id="pack_10", name="10 € Paket", bids=22, price=10.00),
    "pack_15": BidPackage(id="pack_15", name="15 € Paket", bids=35, price=15.00),
    "pack_25": BidPackage(id="pack_25", name="25 € Paket", bids=60, price=25.00, popular=True),
    "pack_50": BidPackage(id="pack_50", name="50 € Paket", bids=130, price=50.00),
    "pack_75": BidPackage(id="pack_75", name="75 € Paket", bids=200, price=75.00),
    "pack_100": BidPackage(id="pack_100", name="100 € Paket", bids=280, price=100.00),
    "pack_150": BidPackage(id="pack_150", name="150 € Paket", bids=450, price=150.00),
}

# Affiliate Commission Structure (per lead/month)
AFFILIATE_COMMISSIONS = {
    "tier1": {"min_leads": 1, "max_leads": 5, "commission": 3.00},
    "tier2": {"min_leads": 6, "max_leads": 20, "commission": 5.00},
    "tier3": {"min_leads": 21, "max_leads": 50, "commission": 7.00},
    "tier4": {"min_leads": 51, "max_leads": float('inf'), "commission": 9.00},
}
AFFILIATE_BASE_COMMISSION = 8.00  # Minimum €8 per lead who buys

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, is_admin: bool = False) -> str:
    payload = {
        "user_id": user_id,
        "is_admin": is_admin,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ==================== EMAIL HELPERS ====================

async def send_email(to_email: str, subject: str, html_content: str) -> dict:
    """Send email using Resend API. Returns success status."""
    if not RESEND_API_KEY:
        logger.warning(f"[EMAIL MOCK] No RESEND_API_KEY - Would send to {to_email}: {subject}")
        return {"status": "mocked", "message": f"Email would be sent to {to_email}"}
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        # Run sync SDK in thread to keep FastAPI non-blocking
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
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:linear-gradient(135deg,#FFD700,#FF4D4D); padding:30px; text-align:center;">
                    <h1 style="color:#111; margin:0; font-size:28px;">🎉 Herzlichen Glückwunsch!</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:18px; color:#333; margin-bottom:20px;">
                        Hallo <strong>{winner_name}</strong>,
                    </p>
                    <p style="font-size:16px; color:#555; line-height:1.6;">
                        Sie haben die Auktion gewonnen! 🏆
                    </p>
                    
                    <table width="100%" style="background:#f9f9f9; border-radius:10px; padding:20px; margin:20px 0;">
                        <tr>
                            <td style="padding:10px;">
                                <p style="margin:0; font-size:14px; color:#888;">Produkt:</p>
                                <p style="margin:5px 0 0; font-size:18px; color:#333; font-weight:bold;">{product_name}</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:10px;">
                                <p style="margin:0; font-size:14px; color:#888;">Ihr Gewinnpreis:</p>
                                <p style="margin:5px 0 0; font-size:28px; color:#10B981; font-weight:bold;">€{final_price:.2f}</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:10px;">
                                <p style="margin:0; font-size:14px; color:#888;">UVP:</p>
                                <p style="margin:5px 0 0; font-size:16px; color:#999; text-decoration:line-through;">€{retail_price:.2f}</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:10px;">
                                <p style="margin:0; font-size:14px; color:#888;">Sie sparen:</p>
                                <p style="margin:5px 0 0; font-size:18px; color:#FF4D4D; font-weight:bold;">{savings:.0f}%</p>
                            </td>
                        </tr>
                    </table>
                    
                    <p style="font-size:16px; color:#555; line-height:1.6;">
                        <strong>Nächste Schritte:</strong>
                    </p>
                    <ol style="color:#555; line-height:1.8;">
                        <li>Melden Sie sich in Ihrem Dashboard an</li>
                        <li>Gehen Sie zu "Gewonnene Auktionen"</li>
                        <li>Bezahlen Sie den Gewinnpreis innerhalb von 7 Tagen</li>
                        <li>Wir versenden Ihr Produkt nach Zahlungseingang</li>
                    </ol>
                    
                    <table width="100%" style="margin-top:30px;">
                        <tr>
                            <td style="text-align:center;">
                                <a href="#" style="display:inline-block; background:linear-gradient(135deg,#FFD700,#FF4D4D); color:#111; text-decoration:none; padding:15px 40px; border-radius:30px; font-weight:bold; font-size:16px;">
                                    Zum Dashboard →
                                </a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr>
                <td style="background:#111; padding:20px; text-align:center;">
                    <p style="color:#888; font-size:12px; margin:0;">
                        © 2026 BidBlitz GmbH • Alle Rechte vorbehalten
                    </p>
                    <p style="color:#666; font-size:11px; margin:10px 0 0;">
                        Auktions-ID: {auction_id}
                    </p>
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
    <head>
        <meta charset="utf-8">
    </head>
    <body style="margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff;">
            <tr>
                <td style="background:#111; padding:30px; text-align:center;">
                    <h1 style="color:#FFD700; margin:0; font-size:24px;">Passwort zurücksetzen</h1>
                </td>
            </tr>
            <tr>
                <td style="padding:30px;">
                    <p style="font-size:16px; color:#333;">
                        Hallo {user_name},
                    </p>
                    <p style="font-size:14px; color:#555; line-height:1.6;">
                        Sie haben angefordert, Ihr Passwort zurückzusetzen. Verwenden Sie den folgenden Code:
                    </p>
                    <div style="background:#f5f5f5; padding:20px; text-align:center; margin:20px 0; border-radius:10px;">
                        <span style="font-size:32px; font-weight:bold; letter-spacing:8px; color:#111; font-family:monospace;">
                            {reset_code}
                        </span>
                    </div>
                    <p style="font-size:14px; color:#888;">
                        Dieser Code ist 15 Minuten gültig.
                    </p>
                    <p style="font-size:12px; color:#999; margin-top:30px;">
                        Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
                    </p>
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

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(user: dict = Depends(get_current_user)):
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ENDPOINTS ====================

# Known VPN/Proxy/Datacenter IP ranges and detection
async def check_vpn_proxy(ip_address: str) -> dict:
    """Check if IP is a VPN, proxy, or datacenter IP using free API"""
    if not ip_address or ip_address in ["unknown", "127.0.0.1", "localhost"]:
        return {"is_vpn": False, "is_proxy": False, "is_datacenter": False}
    
    try:
        # Use ip-api.com free service for VPN/proxy detection
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            # First check with ip-api.com (free, 45 req/min)
            response = await client.get(f"http://ip-api.com/json/{ip_address}?fields=status,proxy,hosting")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    is_proxy = data.get("proxy", False)
                    is_hosting = data.get("hosting", False)  # Datacenter/VPN
                    return {
                        "is_vpn": is_hosting,
                        "is_proxy": is_proxy,
                        "is_datacenter": is_hosting
                    }
    except Exception as e:
        logger.warning(f"VPN check failed for {ip_address}: {e}")
    
    return {"is_vpn": False, "is_proxy": False, "is_datacenter": False}

@api_router.post("/auth/register", response_model=dict)
async def register(user_data: UserCreate, request: Request):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password strength
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Get user's IP and referrer for tracking
    client_ip = request.client.host if request.client else "unknown"
    
    # Get real IP from X-Forwarded-For header (behind proxy/load balancer)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    
    # Also check X-Real-IP header
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        client_ip = real_ip.strip()
    
    # VPN/Proxy Detection - Block VPN users
    vpn_check = await check_vpn_proxy(client_ip)
    if vpn_check.get("is_vpn") or vpn_check.get("is_proxy") or vpn_check.get("is_datacenter"):
        logger.warning(f"VPN/Proxy blocked registration attempt from IP: {client_ip}")
        await log_security_event("registration_blocked_vpn", "unknown", {"email": user_data.email, "reason": "VPN/Proxy"}, client_ip)
        raise HTTPException(
            status_code=403, 
            detail="VPN, Proxy oder Datacenter-Verbindungen sind nicht erlaubt. Bitte deaktivieren Sie Ihren VPN und versuchen Sie es erneut."
        )
    
    # IP restriction - check if this IP already has an account
    if client_ip and client_ip != "unknown" and client_ip != "127.0.0.1":
        existing_ip_user = await db.users.find_one({"ip_address": client_ip, "is_admin": False})
        if existing_ip_user:
            await log_security_event("registration_blocked_ip", "unknown", {"email": user_data.email, "reason": "Duplicate IP"}, client_ip)
            raise HTTPException(
                status_code=400, 
                detail="Von dieser IP-Adresse wurde bereits ein Konto erstellt. Nur ein Konto pro Haushalt erlaubt."
            )
    
    referrer = request.headers.get("referer", "direct")
    user_agent = request.headers.get("user-agent", "unknown")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "bids_balance": 10,  # Free starting bids
        "is_admin": False,
        "is_blocked": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "won_auctions": [],
        "total_bids_placed": 0,
        "total_deposits": 0.0,
        "source": user_data.source or "direct",
        "ip_address": client_ip,
        "referrer": referrer,
        "user_agent": user_agent,
        "country": "Unknown",
        "referred_by": user_data.referral_code,
        "affiliate_id": None,
        # 2FA fields
        "two_factor_enabled": False,
        "two_factor_secret": None,
        "last_login": None,
        "login_count": 0
    }
    await db.users.insert_one(user)
    
    # Log registration
    await log_security_event("registration", user_id, {"email": user_data.email, "user_agent": user_agent}, client_ip)
    
    # Process referral code if provided
    if user_data.referral_code:
        affiliate = await db.affiliates.find_one({"referral_code": user_data.referral_code, "status": "active"})
        if affiliate:
            # Create lead record
            lead = {
                "id": str(uuid.uuid4()),
                "affiliate_id": affiliate["id"],
                "user_id": user_id,
                "referral_code": user_data.referral_code,
                "converted": False,
                "conversion_amount": 0,
                "commission_earned": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "converted_at": None
            }
            await db.affiliate_leads.insert_one(lead)
            
            # Update affiliate and user
            await db.affiliates.update_one(
                {"id": affiliate["id"]},
                {"$inc": {"total_referrals": 1}, "$push": {"referrals": user_id}}
            )
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"affiliate_id": affiliate["id"]}}
            )
            logger.info(f"New referral tracked: {user_id} from affiliate {affiliate['id']}")
        else:
            # Check if it's a user referral (8 char code = user ID prefix)
            referrer = await db.users.find_one({"id": {"$regex": f"^{user_data.referral_code}", "$options": "i"}})
            if referrer:
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"referred_by_user": referrer["id"]}}
                )
                # Process referral reward for the referrer
                await process_user_referral_reward(referrer["id"])
                logger.info(f"User referral: {user_id} referred by {referrer['id']}")
    
    token = create_token(user_id)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": user["name"],
            "bids_balance": user["bids_balance"],
            "is_admin": user["is_admin"]
        }
    }

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    user_agent = request.headers.get("user-agent", "unknown")
    
    # Check login attempts (rate limiting)
    can_login, wait_minutes = await check_login_attempts(client_ip, credentials.email)
    if not can_login:
        raise HTTPException(
            status_code=429, 
            detail=f"Zu viele fehlgeschlagene Anmeldeversuche. Bitte warten Sie {wait_minutes} Minuten."
        )
    
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        # Log failed attempt
        await log_security_event("login_failed", user["id"] if user else "unknown", {
            "email": credentials.email,
            "reason": "Invalid credentials",
            "user_agent": user_agent
        }, client_ip)
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    # Check if user is blocked
    if user.get("is_blocked", False):
        await log_security_event("login_blocked", user["id"], {"reason": "Account blocked", "user_agent": user_agent}, client_ip)
        raise HTTPException(status_code=403, detail="Ihr Konto wurde gesperrt. Bitte kontaktieren Sie den Support.")
    
    # Check if 2FA is enabled
    if user.get("two_factor_enabled") and user.get("two_factor_secret"):
        if not credentials.two_factor_code:
            return {
                "requires_2fa": True,
                "message": "Bitte geben Sie Ihren 2FA-Code ein"
            }
        
        # Verify 2FA code
        if not verify_2fa_code(user["two_factor_secret"], credentials.two_factor_code):
            await log_security_event("login_failed_2fa", user["id"], {"reason": "Invalid 2FA code", "user_agent": user_agent}, client_ip)
            raise HTTPException(status_code=401, detail="Ungültiger 2FA-Code")
    
    # Log successful login
    await log_security_event("login_success", user["id"], {"user_agent": user_agent}, client_ip)
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"last_login": datetime.now(timezone.utc).isoformat()},
            "$inc": {"login_count": 1}
        }
    )
    
    token = create_token(user["id"], user.get("is_admin", False))
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "bids_balance": user["bids_balance"],
            "is_admin": user.get("is_admin", False),
            "two_factor_enabled": user.get("two_factor_enabled", False)
        }
    }

@api_router.get("/auth/me", response_model=dict)
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "bids_balance": user["bids_balance"],
        "is_admin": user.get("is_admin", False),
        "won_auctions": user.get("won_auctions", []),
        "total_bids_placed": user.get("total_bids_placed", 0),
        "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat()),
        "two_factor_enabled": user.get("two_factor_enabled", False),
        "last_login": user.get("last_login")
    }

# ==================== 2FA ENDPOINTS ====================

@api_router.post("/auth/2fa/setup")
async def setup_2fa(user: dict = Depends(get_current_user)):
    """Generate a new 2FA secret and QR code"""
    if user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA ist bereits aktiviert")
    
    secret = generate_2fa_secret()
    qr_code = generate_2fa_qr_code(user["email"], secret)
    
    # Store secret temporarily (not enabled yet)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"two_factor_secret_temp": secret}}
    )
    
    return {
        "secret": secret,
        "qr_code": qr_code,
        "message": "Scannen Sie den QR-Code mit Ihrer Authenticator-App"
    }

@api_router.post("/auth/2fa/enable")
async def enable_2fa(code: str, user: dict = Depends(get_current_user), request: Request = None):
    """Enable 2FA by verifying the first code"""
    client_ip = request.client.host if request and request.client else "unknown"
    
    # Get temporary secret
    current_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    temp_secret = current_user.get("two_factor_secret_temp")
    
    if not temp_secret:
        raise HTTPException(status_code=400, detail="Bitte starten Sie die 2FA-Einrichtung zuerst")
    
    # Verify the code
    if not verify_2fa_code(temp_secret, code):
        raise HTTPException(status_code=400, detail="Ungültiger Code. Bitte versuchen Sie es erneut.")
    
    # Enable 2FA
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "two_factor_enabled": True,
                "two_factor_secret": temp_secret
            },
            "$unset": {"two_factor_secret_temp": ""}
        }
    )
    
    # Log security event
    await log_security_event("2fa_enabled", user["id"], {"method": "TOTP"}, client_ip)
    
    return {"message": "2FA erfolgreich aktiviert", "two_factor_enabled": True}

@api_router.post("/auth/2fa/disable")
async def disable_2fa(password: str, code: str, user: dict = Depends(get_current_user), request: Request = None):
    """Disable 2FA with password and current code verification"""
    client_ip = request.client.host if request and request.client else "unknown"
    
    current_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    # Verify password
    if not verify_password(password, current_user["password"]):
        raise HTTPException(status_code=401, detail="Falsches Passwort")
    
    # Verify 2FA code
    if not current_user.get("two_factor_enabled") or not current_user.get("two_factor_secret"):
        raise HTTPException(status_code=400, detail="2FA ist nicht aktiviert")
    
    if not verify_2fa_code(current_user["two_factor_secret"], code):
        raise HTTPException(status_code=401, detail="Ungültiger 2FA-Code")
    
    # Disable 2FA
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"two_factor_enabled": False},
            "$unset": {"two_factor_secret": ""}
        }
    )
    
    # Log security event
    await log_security_event("2fa_disabled", user["id"], {}, client_ip)
    
    return {"message": "2FA deaktiviert", "two_factor_enabled": False}

# ==================== SECURITY LOG ENDPOINTS (Admin) ====================

@api_router.get("/admin/security-logs")
async def get_security_logs(
    limit: int = 100,
    event_type: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Get security logs (admin only)"""
    query = {}
    if event_type:
        query["event_type"] = event_type
    
    logs = await db.security_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return logs

@api_router.get("/admin/security-stats")
async def get_security_stats(admin: dict = Depends(get_admin_user)):
    """Get security statistics (admin only)"""
    now = datetime.now(timezone.utc)
    last_24h = (now - timedelta(hours=24)).isoformat()
    last_7d = (now - timedelta(days=7)).isoformat()
    
    # Count events
    logins_24h = await db.security_logs.count_documents({"event_type": "login_success", "timestamp": {"$gte": last_24h}})
    failed_24h = await db.security_logs.count_documents({"event_type": "login_failed", "timestamp": {"$gte": last_24h}})
    registrations_24h = await db.security_logs.count_documents({"event_type": "registration", "timestamp": {"$gte": last_24h}})
    blocked_vpn_24h = await db.security_logs.count_documents({"event_type": "registration_blocked_vpn", "timestamp": {"$gte": last_24h}})
    
    logins_7d = await db.security_logs.count_documents({"event_type": "login_success", "timestamp": {"$gte": last_7d}})
    failed_7d = await db.security_logs.count_documents({"event_type": "login_failed", "timestamp": {"$gte": last_7d}})
    
    # Users with 2FA
    users_with_2fa = await db.users.count_documents({"two_factor_enabled": True})
    total_users = await db.users.count_documents({})
    
    return {
        "last_24h": {
            "successful_logins": logins_24h,
            "failed_logins": failed_24h,
            "registrations": registrations_24h,
            "vpn_blocks": blocked_vpn_24h
        },
        "last_7d": {
            "successful_logins": logins_7d,
            "failed_logins": failed_7d
        },
        "users": {
            "total": total_users,
            "with_2fa": users_with_2fa,
            "2fa_percentage": round((users_with_2fa / total_users * 100) if total_users > 0 else 0, 1)
        }
    }

# ==================== PASSWORD RESET ENDPOINTS ====================

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists, a reset code has been sent"}
    
    # Generate 6-character code
    import random
    import string
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    logger.info(f"Password reset code for {request.email}: {code}")
    
    # Store in database for persistence
    await db.password_resets.update_one(
        {"email": request.email},
        {"$set": {
            "code": code,
            "expires": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
            "used": False
        }},
        upsert=True
    )
    
    # Send reset email
    try:
        email_result = await send_password_reset_email(
            to_email=request.email,
            reset_code=code,
            user_name=user.get("name", "Nutzer")
        )
        logger.info(f"Password reset email sent: {email_result}")
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")
    
    return {"message": "Reset code sent", "demo_code": code}  # demo_code for testing

@api_router.post("/auth/verify-reset-code")
async def verify_reset_code(request: VerifyResetCodeRequest):
    reset = await db.password_resets.find_one({
        "email": request.email,
        "code": request.code.upper(),
        "used": False
    }, {"_id": 0})
    
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    # Check expiration
    expires = datetime.fromisoformat(reset["expires"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Code expired")
    
    return {"message": "Code verified", "valid": True}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    reset = await db.password_resets.find_one({
        "email": request.email,
        "code": request.code.upper(),
        "used": False
    }, {"_id": 0})
    
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    # Check expiration
    expires = datetime.fromisoformat(reset["expires"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Code expired")
    
    # Hash new password
    hashed = bcrypt.hashpw(request.new_password.encode('utf-8'), bcrypt.gensalt())
    
    # Update user password (use 'password' field for consistency with login)
    result = await db.users.update_one(
        {"email": request.email},
        {"$set": {"password": hashed.decode('utf-8')}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Mark reset code as used
    await db.password_resets.update_one(
        {"email": request.email, "code": request.code.upper()},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successfully"}

# ==================== USER PROFILE ENDPOINTS ====================

@api_router.put("/user/profile")
async def update_profile(data: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    update_data = {}
    
    if data.name:
        update_data["name"] = data.name
    
    if data.email and data.email != user["email"]:
        # Check if email is already taken
        existing = await db.users.find_one({"email": data.email, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_data["email"] = data.email
    
    if not update_data:
        return {"message": "No changes", "user": user}
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "hashed_password": 0})
    
    return {"message": "Profile updated", "user": updated_user}

@api_router.put("/user/change-password")
async def change_password(data: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    # Get user with password
    full_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    # Verify current password - check both 'password' and 'hashed_password' fields for compatibility
    stored_password = full_user.get("password") or full_user.get("hashed_password")
    if not stored_password or not bcrypt.checkpw(data.current_password.encode('utf-8'), stored_password.encode('utf-8')):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    hashed = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt())
    
    # Update password field (consistent with registration and login)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password": hashed.decode('utf-8'),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/user/bid-history")
async def get_bid_history(user: dict = Depends(get_current_user)):
    # Get all auctions where user has bid
    auctions = await db.auctions.find({}, {"_id": 0}).to_list(1000)
    
    bid_history = []
    for auction in auctions:
        for bid in auction.get("bid_history", []):
            if bid.get("user_id") == user["id"]:
                product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
                bid_history.append({
                    "auction_id": auction["id"],
                    "product": product,
                    "price": bid.get("price"),
                    "timestamp": bid.get("timestamp"),
                    "won": auction.get("winner_id") == user["id"],
                    "auction_ended": auction.get("status") == "ended"
                })
    
    # Sort by timestamp descending
    bid_history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    return bid_history[:100]  # Limit to last 100

@api_router.get("/user/purchases")
async def get_purchases(user: dict = Depends(get_current_user)):
    purchases = await db.payment_transactions.find(
        {"user_id": user["id"], "status": "paid"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return purchases

# ==================== PRODUCT ENDPOINTS ====================

@api_router.post("/admin/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, admin: dict = Depends(get_admin_user)):
    product_id = str(uuid.uuid4())
    doc = {
        "id": product_id,
        **product.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.products.insert_one(doc)
    return ProductResponse(**doc)

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products():
    products = await db.products.find({}, {"_id": 0}).to_list(100)
    return [ProductResponse(**p) for p in products]

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse(**product)

@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# ==================== AUCTION ENDPOINTS ====================

@api_router.post("/admin/auctions", response_model=AuctionResponse)
async def create_auction(auction: AuctionCreate, admin: dict = Depends(get_admin_user)):
    product = await db.products.find_one({"id": auction.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    auction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Determine start_time and end_time
    if auction.start_time and auction.end_time:
        # Scheduled auction with explicit start and end times
        start_time = datetime.fromisoformat(auction.start_time.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(auction.end_time.replace('Z', '+00:00'))
        # Status is 'scheduled' if start_time is in the future, otherwise 'active'
        status = "scheduled" if start_time > now else "active"
    elif auction.start_time:
        # Scheduled start with duration
        start_time = datetime.fromisoformat(auction.start_time.replace('Z', '+00:00'))
        duration = auction.duration_seconds or 300  # Default 5 minutes
        end_time = start_time + timedelta(seconds=duration)
        status = "scheduled" if start_time > now else "active"
    elif auction.end_time:
        # Immediate start with explicit end time
        start_time = now
        end_time = datetime.fromisoformat(auction.end_time.replace('Z', '+00:00'))
        status = "active"
    else:
        # Traditional: immediate start with duration
        start_time = now
        duration = auction.duration_seconds or 300
        end_time = now + timedelta(seconds=duration)
        status = "active"
    
    doc = {
        "id": auction_id,
        "product_id": auction.product_id,
        "current_price": auction.starting_price,
        "bid_increment": auction.bid_increment,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "status": status,
        "winner_id": None,
        "winner_name": None,
        "total_bids": 0,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "created_at": now.isoformat(),
        "bid_history": [],
        "bot_target_price": auction.bot_target_price or 0  # Bot target price for last-second bidding
    }
    await db.auctions.insert_one(doc)
    
    return AuctionResponse(**doc, product=product)

@api_router.get("/auctions", response_model=List[AuctionResponse])
async def get_auctions(status: Optional[str] = None):
    # First, check and update scheduled auctions that should now be active
    now = datetime.now(timezone.utc)
    await db.auctions.update_many(
        {
            "status": "scheduled",
            "start_time": {"$lte": now.isoformat()}
        },
        {"$set": {"status": "active"}}
    )
    
    # Also check and end auctions that have passed their end_time
    await db.auctions.update_many(
        {
            "status": "active",
            "end_time": {"$lte": now.isoformat()}
        },
        {"$set": {"status": "ended"}}
    )
    
    query = {}
    if status:
        query["status"] = status
    
    auctions = await db.auctions.find(query, {"_id": 0, "bid_history": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with product data
    result = []
    for auction in auctions:
        product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
        result.append(AuctionResponse(**auction, product=product))
    
    return result

@api_router.get("/auctions/{auction_id}", response_model=AuctionResponse)
async def get_auction(auction_id: str):
    # Check if this auction should be activated or ended
    now = datetime.now(timezone.utc)
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "bid_history": 0})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Update status if needed
    if auction.get("status") == "scheduled" and auction.get("start_time"):
        start_time = datetime.fromisoformat(auction["start_time"].replace('Z', '+00:00'))
        if start_time <= now:
            await db.auctions.update_one({"id": auction_id}, {"$set": {"status": "active"}})
            auction["status"] = "active"
    
    if auction.get("status") == "active" and auction.get("end_time"):
        end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
        if end_time <= now:
            # Set winner info
            update_data = {"status": "ended"}
            if auction.get("last_bidder_id"):
                update_data["winner_id"] = auction["last_bidder_id"]
                update_data["winner_name"] = auction.get("last_bidder_name")
            await db.auctions.update_one({"id": auction_id}, {"$set": update_data})
            auction.update(update_data)
    
    product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
    return AuctionResponse(**auction, product=product)

@api_router.post("/auctions/{auction_id}/bid")
async def place_bid(auction_id: str, user: dict = Depends(get_current_user)):
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    # Check if auction has ended
    end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > end_time:
        raise HTTPException(status_code=400, detail="Auction has ended")
    
    # Check user's bid balance
    if user["bids_balance"] < 1:
        raise HTTPException(status_code=400, detail="Insufficient bids. Please buy more bids.")
    
    # Deduct bid from user
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": -1, "total_bids_placed": 1}}
    )
    
    # Update auction - extend timer by 10-15 seconds, don't reset
    new_price = auction["current_price"] + auction["bid_increment"]
    current_end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    
    # Only extend if less than 60 seconds remaining, add 10-15 seconds
    time_remaining = (current_end_time - now).total_seconds()
    if time_remaining < 60:
        # Extend by 15 seconds from now if very low, otherwise add to current end time
        if time_remaining < 15:
            new_end_time = now + timedelta(seconds=15)
        else:
            new_end_time = current_end_time + timedelta(seconds=10)
    else:
        # If more than 60 seconds left, don't extend
        new_end_time = current_end_time
    
    await db.auctions.update_one(
        {"id": auction_id},
        {
            "$set": {
                "current_price": new_price,
                "end_time": new_end_time.isoformat(),
                "last_bidder_id": user["id"],
                "last_bidder_name": user["name"]
            },
            "$inc": {"total_bids": 1},
            "$push": {
                "bid_history": {
                    "user_id": user["id"],
                    "user_name": user["name"],
                    "price": new_price,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "is_autobid": False
                }
            }
        }
    )
    
    # Broadcast bid update via WebSocket
    try:
        await broadcast_bid_update(auction_id, {
            "current_price": new_price,
            "end_time": new_end_time.isoformat(),
            "last_bidder_name": user["name"],
            "total_bids": auction.get("total_bids", 0) + 1,
            "bidder_message": f"{user['name']} hat geboten!"
        })
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")
    
    # Trigger autobidders (in background)
    try:
        await process_autobidders(auction_id, user["id"])
    except Exception as e:
        logger.error(f"Autobidder error: {e}")
    
    return {
        "message": "Bid placed successfully",
        "new_price": new_price,
        "new_end_time": new_end_time.isoformat(),
        "bids_remaining": user["bids_balance"] - 1
    }

@api_router.post("/admin/auctions/{auction_id}/end")
async def end_auction(auction_id: str, admin: dict = Depends(get_admin_user)):
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    winner_id = auction.get("last_bidder_id")
    winner_name = auction.get("last_bidder_name")
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "status": "ended",
            "winner_id": winner_id,
            "winner_name": winner_name,
            "ended_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Broadcast auction ended via WebSocket
    try:
        await broadcast_auction_ended(
            auction_id=auction_id,
            winner_name=winner_name or "Kein Gewinner",
            final_price=auction.get("current_price", 0)
        )
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")
    
    # Add to winner's won auctions and send notification email
    if winner_id:
        await db.users.update_one(
            {"id": winner_id},
            {"$push": {"won_auctions": auction_id}}
        )
        
        # Send winner notification email
        try:
            winner = await db.users.find_one({"id": winner_id}, {"_id": 0})
            product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
            if winner and product:
                await send_winner_notification(
                    winner_email=winner["email"],
                    winner_name=winner.get("name", "Gewinner"),
                    product_name=product.get("name", "Produkt"),
                    final_price=auction.get("current_price", 0),
                    retail_price=product.get("retail_price", 0),
                    auction_id=auction_id
                )
                logger.info(f"Winner notification sent to {winner['email']} for auction {auction_id}")
        except Exception as e:
            logger.error(f"Failed to send winner notification: {e}")
    
    return {"message": "Auction ended", "winner_id": winner_id, "winner_name": winner_name}

@api_router.post("/admin/auctions/{auction_id}/restart")
async def restart_auction(
    auction_id: str, 
    duration_seconds: int = 600,  # Default 10 minutes
    bot_target_price: Optional[float] = None,
    admin: dict = Depends(get_admin_user)
):
    """Restart an ended auction with the same product"""
    # Get the ended auction
    old_auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not old_auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if old_auction["status"] != "ended":
        raise HTTPException(status_code=400, detail="Only ended auctions can be restarted")
    
    # Create new auction with same product
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(seconds=duration_seconds)
    
    new_auction = {
        "id": str(uuid.uuid4()),
        "product_id": old_auction["product_id"],
        "starting_price": 0.01,
        "current_price": 0.01,
        "bid_increment": old_auction.get("bid_increment", 0.01),
        "start_time": now.isoformat(),
        "end_time": end_time.isoformat(),
        "status": "active",
        "total_bids": 0,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "winner_id": None,
        "winner_name": None,
        "bid_history": [],
        "created_at": now.isoformat(),
        "created_by": admin["id"],
        "restarted_from": auction_id
    }
    
    await db.auctions.insert_one(new_auction)
    
    # If bot target price specified, start bot bidding
    bots_result = None
    if bot_target_price and bot_target_price > 0.01:
        import random
        bots = await db.bots.find({"is_active": True}, {"_id": 0}).to_list(100)
        if bots:
            current_price = 0.01
            increment = new_auction["bid_increment"]
            bids_placed = 0
            last_bot = None
            
            while current_price < bot_target_price:
                available_bots = [b for b in bots if b["id"] != (last_bot["id"] if last_bot else None)]
                if not available_bots:
                    available_bots = bots
                bot = random.choice(available_bots)
                last_bot = bot
                
                new_price = round(current_price + increment, 2)
                new_end_time = datetime.now(timezone.utc) + timedelta(seconds=15)
                
                await db.auctions.update_one(
                    {"id": new_auction["id"]},
                    {
                        "$set": {
                            "current_price": new_price,
                            "end_time": new_end_time.isoformat(),
                            "last_bidder_id": f"bot_{bot['id']}",
                            "last_bidder_name": bot["name"]
                        },
                        "$inc": {"total_bids": 1},
                        "$push": {
                            "bid_history": {
                                "user_id": f"bot_{bot['id']}",
                                "user_name": bot["name"],
                                "price": new_price,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "is_bot": True
                            }
                        }
                    }
                )
                
                await db.bots.update_one({"id": bot["id"]}, {"$inc": {"total_bids_placed": 1}})
                current_price = new_price
                bids_placed += 1
                
                if bids_placed >= 1000:
                    break
            
            bots_result = {"bids_placed": bids_placed, "final_price": current_price}
    
    # Get product info for response
    product = await db.products.find_one({"id": new_auction["product_id"]}, {"_id": 0})
    new_auction["product"] = product
    new_auction.pop("_id", None)
    
    return {
        "message": "Auction restarted",
        "auction": new_auction,
        "bot_bidding": bots_result
    }

@api_router.delete("/admin/auctions/{auction_id}")
async def delete_auction(auction_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.auctions.delete_one({"id": auction_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auction not found")
    return {"message": "Auction deleted"}

# ==================== BID PACKAGES & PAYMENT ====================

@api_router.get("/bid-packages")
async def get_bid_packages():
    return list(BID_PACKAGES.values())

@api_router.post("/checkout/create-session")
async def create_checkout_session(request: CheckoutRequest, http_request: Request, user: dict = Depends(get_current_user)):
    if request.package_id not in BID_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = BID_PACKAGES[request.package_id]
    
    # Initialize Stripe
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Build URLs from frontend origin
    success_url = f"{request.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/buy-bids"
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=package.price,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["id"],
            "package_id": package.id,
            "bids": str(package.bids)
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Store transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "package_id": package.id,
        "amount": package.price,
        "currency": "usd",
        "bids": package.bids,
        "status": "pending",
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, http_request: Request, user: dict = Depends(get_current_user)):
    # Check if already processed
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["payment_status"] == "paid":
        return {"status": "complete", "payment_status": "paid", "message": "Payment already processed"}
    
    # Initialize Stripe and check status
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    if status.payment_status == "paid" and transaction["payment_status"] != "paid":
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "complete", "payment_status": "paid"}}
        )
        
        # Add bids to user AND update total deposits
        await db.users.update_one(
            {"id": transaction["user_id"]},
            {
                "$inc": {
                    "bids_balance": transaction["bids"],
                    "total_deposits": transaction["amount"]
                }
            }
        )
        
        # Process affiliate commission if this user was referred
        commission = await process_affiliate_commission(transaction["user_id"], transaction["amount"])
        if commission:
            logger.info(f"Affiliate commission €{commission} processed for user {transaction['user_id']}")
        
        # Process referral reward if user qualifies (€5+ deposit)
        await process_referral_after_deposit(transaction["user_id"], transaction["amount"])
        
        return {"status": "complete", "payment_status": "paid", "bids_added": transaction["bids"]}
    
    return {
        "status": status.status,
        "payment_status": status.payment_status
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            
            if transaction and transaction["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"status": "complete", "payment_status": "paid"}}
                )
                await db.users.update_one(
                    {"id": transaction["user_id"]},
                    {
                        "$inc": {
                            "bids_balance": transaction["bids"],
                            "total_deposits": transaction["amount"]
                        }
                    }
                )
                
                # Process affiliate commission
                commission = await process_affiliate_commission(transaction["user_id"], transaction["amount"])
                if commission:
                    logger.info(f"Webhook: Affiliate commission €{commission} for user {transaction['user_id']}")
                
                # Process referral reward if user qualifies (€5+ deposit)
                await process_referral_after_deposit(transaction["user_id"], transaction["amount"])
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ==================== CRYPTO PAYMENT ENDPOINTS (Coinbase Commerce) ====================

@api_router.post("/checkout/crypto/create")
async def create_crypto_checkout(
    data: CryptoCheckoutRequest, 
    http_request: Request,
    user: dict = Depends(get_current_user)
):
    """Create a Coinbase Commerce charge for cryptocurrency payment"""
    if not coinbase_client:
        raise HTTPException(status_code=503, detail="Crypto payments not configured")
    
    try:
        # Create charge with Coinbase Commerce
        charge_data = {
            "name": f"BidBlitz - {data.bids} Gebote",
            "description": f"Gebotspaket mit {data.bids} Geboten für BidBlitz Auktionen",
            "pricing_type": "fixed_price",
            "local_price": {
                "amount": str(data.price),
                "currency": "EUR"
            },
            "metadata": {
                "user_id": user["id"],
                "package_id": data.package_id,
                "bids": str(data.bids)
            },
            "redirect_url": f"{str(http_request.base_url).rstrip('/')}/buy-bids?crypto_success=true",
            "cancel_url": f"{str(http_request.base_url).rstrip('/')}/buy-bids?crypto_cancel=true"
        }
        
        charge = coinbase_client.charge.create(**charge_data)
        
        # Store transaction in database
        transaction = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "charge_id": charge.id,
            "payment_method": "crypto",
            "package_id": data.package_id,
            "bids": data.bids,
            "amount": data.price,
            "currency": "EUR",
            "status": "pending",
            "payment_status": "pending",
            "hosted_url": charge.hosted_url,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.crypto_transactions.insert_one(transaction)
        
        logger.info(f"Crypto charge created: {charge.id} for user {user['id']}")
        
        return {
            "charge_id": charge.id,
            "hosted_url": charge.hosted_url,
            "status": "pending"
        }
        
    except CoinbaseError as e:
        logger.error(f"Coinbase Commerce error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating crypto charge: {e}")
        raise HTTPException(status_code=500, detail="Failed to create crypto payment")

@api_router.get("/checkout/crypto/status/{charge_id}")
async def get_crypto_checkout_status(charge_id: str, user: dict = Depends(get_current_user)):
    """Check the status of a cryptocurrency payment"""
    if not coinbase_client:
        raise HTTPException(status_code=503, detail="Crypto payments not configured")
    
    try:
        # First check our database
        transaction = await db.crypto_transactions.find_one(
            {"charge_id": charge_id, "user_id": user["id"]}, 
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # If already completed, return cached status
        if transaction.get("payment_status") == "paid":
            return {
                "charge_id": charge_id,
                "status": "completed",
                "payment_status": "paid",
                "bids_added": transaction.get("bids")
            }
        
        # Check with Coinbase Commerce
        charge = coinbase_client.charge.retrieve(charge_id)
        
        # Get latest status from timeline
        latest_status = charge.timeline[-1]["status"] if charge.timeline else "NEW"
        
        status_map = {
            "NEW": "pending",
            "PENDING": "pending",
            "COMPLETED": "completed",
            "CONFIRMED": "completed",
            "UNRESOLVED": "failed",
            "RESOLVED": "completed",
            "EXPIRED": "expired",
            "CANCELED": "canceled"
        }
        
        internal_status = status_map.get(latest_status, "pending")
        
        # If payment completed, update database and add bids
        if internal_status == "completed" and transaction.get("payment_status") != "paid":
            await db.crypto_transactions.update_one(
                {"charge_id": charge_id},
                {"$set": {"status": "complete", "payment_status": "paid"}}
            )
            
            # Add bids to user
            await db.users.update_one(
                {"id": transaction["user_id"]},
                {
                    "$inc": {
                        "bids_balance": transaction["bids"],
                        "total_deposits": transaction["amount"]
                    }
                }
            )
            
            # Process affiliate commission and referral rewards
            await process_affiliate_commission(transaction["user_id"], transaction["amount"])
            await process_referral_after_deposit(transaction["user_id"], transaction["amount"])
            
            logger.info(f"Crypto payment completed: {charge_id}, added {transaction['bids']} bids to user {transaction['user_id']}")
            
            return {
                "charge_id": charge_id,
                "status": "completed",
                "payment_status": "paid",
                "bids_added": transaction["bids"]
            }
        
        return {
            "charge_id": charge_id,
            "status": internal_status,
            "payment_status": internal_status,
            "coinbase_status": latest_status
        }
        
    except CoinbaseError as e:
        logger.error(f"Coinbase Commerce error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error checking crypto status: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

@api_router.post("/webhook/coinbase")
async def coinbase_webhook(request: Request):
    """Webhook endpoint for Coinbase Commerce payment notifications"""
    try:
        body = await request.body()
        event_data = await request.json()
        
        event_type = event_data.get("event", {}).get("type")
        charge_data = event_data.get("event", {}).get("data", {})
        charge_id = charge_data.get("id")
        
        logger.info(f"Coinbase webhook received: {event_type} for charge {charge_id}")
        
        if event_type in ["charge:confirmed", "charge:completed"]:
            # Find transaction
            transaction = await db.crypto_transactions.find_one(
                {"charge_id": charge_id},
                {"_id": 0}
            )
            
            if transaction and transaction.get("payment_status") != "paid":
                # Update transaction
                await db.crypto_transactions.update_one(
                    {"charge_id": charge_id},
                    {"$set": {"status": "complete", "payment_status": "paid"}}
                )
                
                # Add bids to user
                await db.users.update_one(
                    {"id": transaction["user_id"]},
                    {
                        "$inc": {
                            "bids_balance": transaction["bids"],
                            "total_deposits": transaction["amount"]
                        }
                    }
                )
                
                # Process affiliate and referral
                await process_affiliate_commission(transaction["user_id"], transaction["amount"])
                await process_referral_after_deposit(transaction["user_id"], transaction["amount"])
                
                logger.info(f"Crypto webhook: Payment confirmed for charge {charge_id}")
        
        elif event_type == "charge:failed":
            await db.crypto_transactions.update_one(
                {"charge_id": charge_id},
                {"$set": {"status": "failed", "payment_status": "failed"}}
            )
            logger.warning(f"Crypto webhook: Payment failed for charge {charge_id}")
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Coinbase webhook error: {e}")
        return {"status": "error"}

# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/users", response_model=List[dict])
async def get_all_users(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    
    # Add deposit totals from payment_transactions for each user
    for user in users:
        # Get total deposits from paid transactions
        pipeline = [
            {"$match": {"user_id": user["id"], "payment_status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        result = await db.payment_transactions.aggregate(pipeline).to_list(1)
        user["total_deposits"] = result[0]["total"] if result else user.get("total_deposits", 0)
    
    return users

@api_router.put("/admin/users/{user_id}/toggle-admin")
async def toggle_admin(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get("is_admin", False)
    await db.users.update_one({"id": user_id}, {"$set": {"is_admin": new_status}})
    return {"message": f"Admin status set to {new_status}"}

@api_router.put("/admin/users/{user_id}/toggle-block")
async def toggle_block_user(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent blocking yourself
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    new_status = not user.get("is_blocked", False)
    await db.users.update_one({"id": user_id}, {"$set": {"is_blocked": new_status}})
    return {"message": f"User blocked status set to {new_status}", "is_blocked": new_status}

@api_router.put("/admin/users/{user_id}/add-bids")
async def add_bids_to_user(user_id: str, bids: int, admin: dict = Depends(get_admin_user)):
    result = await db.users.update_one({"id": user_id}, {"$inc": {"bids_balance": bids}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"Added {bids} bids to user"}

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    total_auctions = await db.auctions.count_documents({})
    active_auctions = await db.auctions.count_documents({"status": "active"})
    total_products = await db.products.count_documents({})
    total_transactions = await db.payment_transactions.count_documents({"status": "paid"})
    
    return {
        "total_users": total_users,
        "total_auctions": total_auctions,
        "active_auctions": active_auctions,
        "total_products": total_products,
        "completed_transactions": total_transactions
    }

@api_router.get("/admin/stats/detailed")
async def get_detailed_stats(admin: dict = Depends(get_admin_user)):
    """Get detailed statistics for charts and reports."""
    now = datetime.now(timezone.utc)
    
    # Revenue and transactions
    payments = await db.payment_transactions.find({"status": "paid"}, {"_id": 0}).to_list(1000)
    total_revenue = sum(p.get("amount", 0) for p in payments)
    total_bids_sold = sum(p.get("bids", 0) for p in payments)
    
    # Revenue by day (last 7 days)
    revenue_by_day = []
    for i in range(7):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_revenue = sum(
            p.get("amount", 0) for p in payments 
            if p.get("created_at") and 
            day_start.isoformat() <= p.get("created_at", "") < day_end.isoformat()
        )
        revenue_by_day.append({
            "date": day_start.strftime("%d.%m"),
            "revenue": round(day_revenue, 2),
            "day_name": day_start.strftime("%a")
        })
    revenue_by_day.reverse()
    
    # Auctions stats
    auctions = await db.auctions.find({}, {"_id": 0}).to_list(1000)
    ended_auctions = [a for a in auctions if a.get("status") == "ended"]
    total_bids = sum(a.get("total_bids", 0) for a in auctions)
    
    # Bids by day (last 7 days)
    bids_by_day = []
    for i in range(7):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_bids = 0
        for auction in auctions:
            for bid in auction.get("bid_history", []):
                bid_time = bid.get("timestamp", "")
                if day_start.isoformat() <= bid_time < day_end.isoformat():
                    day_bids += 1
        bids_by_day.append({
            "date": day_start.strftime("%d.%m"),
            "bids": day_bids,
            "day_name": day_start.strftime("%a")
        })
    bids_by_day.reverse()
    
    # Users stats
    users = await db.users.find({}, {"_id": 0, "is_admin": 1, "bids_balance": 1, "created_at": 1}).to_list(10000)
    total_users = len(users)
    total_user_bids = sum(u.get("bids_balance", 0) for u in users)
    
    # New users by day (last 7 days)
    users_by_day = []
    for i in range(7):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        new_users = sum(
            1 for u in users 
            if u.get("created_at") and 
            day_start.isoformat() <= u.get("created_at", "") < day_end.isoformat()
        )
        users_by_day.append({
            "date": day_start.strftime("%d.%m"),
            "users": new_users,
            "day_name": day_start.strftime("%a")
        })
    users_by_day.reverse()
    
    # Auction status distribution
    status_distribution = {
        "active": await db.auctions.count_documents({"status": "active"}),
        "scheduled": await db.auctions.count_documents({"status": "scheduled"}),
        "ended": await db.auctions.count_documents({"status": "ended"})
    }
    
    # Top products (by bids) - need to fetch product names
    products_map = {}
    products_list = await db.products.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    for p in products_list:
        products_map[p["id"]] = p.get("name", "Unknown")
    
    top_products = sorted(
        [(products_map.get(a.get("product_id"), "Unknown"), a.get("total_bids", 0)) for a in auctions],
        key=lambda x: x[1],
        reverse=True
    )[:5]
    
    return {
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_transactions": len(payments),
            "total_bids_sold": total_bids_sold,
            "total_bids_placed": total_bids,
            "total_users": total_users,
            "total_user_bids_balance": total_user_bids,
            "ended_auctions": len(ended_auctions),
            "avg_bids_per_auction": round(total_bids / len(auctions), 1) if auctions else 0
        },
        "charts": {
            "revenue_by_day": revenue_by_day,
            "bids_by_day": bids_by_day,
            "users_by_day": users_by_day,
            "status_distribution": status_distribution,
            "top_products": [{"name": p[0], "bids": p[1]} for p in top_products]
        }
    }

# ==================== PAYMENT & LOGS ADMIN ENDPOINTS ====================

@api_router.get("/admin/payments")
async def get_admin_payments(admin: dict = Depends(get_admin_user)):
    payments = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with user data
    for payment in payments:
        if payment.get("user_id"):
            user = await db.users.find_one({"id": payment["user_id"]}, {"_id": 0, "name": 1, "email": 1})
            if user:
                payment["user_name"] = user.get("name")
                payment["user_email"] = user.get("email")
    
    return payments

@api_router.get("/admin/logs")
async def get_admin_logs(admin: dict = Depends(get_admin_user)):
    # Collect logs from various sources
    logs = []
    
    # Get recent bids
    auctions = await db.auctions.find({}, {"_id": 0}).to_list(100)
    for auction in auctions:
        for bid in auction.get("bid_history", [])[-20:]:  # Last 20 bids per auction
            logs.append({
                "type": "bid",
                "message": f"Gebot auf {auction.get('product', {}).get('name', 'Auktion')}: €{bid.get('price', 0):.2f}",
                "timestamp": bid.get("timestamp"),
                "user_email": bid.get("user_name"),
                "auction_id": auction["id"]
            })
    
    # Get recent payments
    payments = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for payment in payments:
        user = await db.users.find_one({"id": payment.get("user_id")}, {"_id": 0, "email": 1})
        logs.append({
            "type": "payment",
            "message": f"Zahlung: {payment.get('package_name', 'Gebotspaket')} - €{payment.get('amount', 0):.2f}",
            "timestamp": payment.get("created_at"),
            "user_email": user.get("email") if user else None,
            "status": payment.get("status")
        })
    
    # Get recent user registrations
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).sort("created_at", -1).to_list(50)
    for user in users:
        if user.get("created_at"):
            logs.append({
                "type": "user",
                "message": f"Neuer Benutzer registriert: {user.get('name')}",
                "timestamp": user.get("created_at"),
                "user_email": user.get("email")
            })
    
    # Get auction events
    for auction in auctions:
        logs.append({
            "type": "auction",
            "message": f"Auktion erstellt: {auction.get('product', {}).get('name', 'Unbekannt')}",
            "timestamp": auction.get("created_at"),
            "auction_id": auction["id"]
        })
        if auction.get("status") == "ended":
            logs.append({
                "type": "auction",
                "message": f"Auktion beendet: Gewinner {auction.get('winner_name', 'N/A')}",
                "timestamp": auction.get("updated_at", auction.get("end_time")),
                "auction_id": auction["id"]
            })
    
    # Sort by timestamp descending
    logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    return logs[:200]  # Return last 200 logs

# ==================== SEED DATA ====================

@api_router.post("/admin/seed")
async def seed_data(admin: dict = Depends(get_admin_user)):
    # Seed products
    products = [
        {
            "id": str(uuid.uuid4()),
            "name": "MacBook Pro 16\"",
            "description": "Apple MacBook Pro with M3 Max chip, 36GB RAM, 1TB SSD",
            "image_url": "https://images.unsplash.com/photo-1537183673931-f890242dbaef?crop=entropy&cs=srgb&fm=jpg&q=85",
            "retail_price": 3499.00,
            "category": "Electronics",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Apple Watch Ultra 2",
            "description": "49mm Titanium Case with Ocean Band",
            "image_url": "https://images.unsplash.com/photo-1687040481503-3595ef7b5672?crop=entropy&cs=srgb&fm=jpg&q=85",
            "retail_price": 799.00,
            "category": "Wearables",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Sony WH-1000XM5",
            "description": "Premium Noise Cancelling Wireless Headphones",
            "image_url": "https://images.unsplash.com/photo-1636489938695-7d25c7b23ba6?crop=entropy&cs=srgb&fm=jpg&q=85",
            "retail_price": 399.00,
            "category": "Audio",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "PlayStation 5 Pro",
            "description": "Next-gen gaming console with 2TB storage",
            "image_url": "https://images.unsplash.com/photo-1681830723200-46731387dfbf?crop=entropy&cs=srgb&fm=jpg&q=85",
            "retail_price": 699.00,
            "category": "Gaming",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for product in products:
        existing = await db.products.find_one({"name": product["name"]})
        if not existing:
            await db.products.insert_one(product)
    
    return {"message": "Seed data created", "products_added": len(products)}

# ==================== VOUCHER SYSTEM ====================

@api_router.post("/admin/vouchers")
async def create_voucher(voucher: VoucherCreate, admin: dict = Depends(get_admin_user)):
    # Check if code already exists
    existing = await db.vouchers.find_one({"code": voucher.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Voucher code already exists")
    
    voucher_doc = {
        "id": str(uuid.uuid4()),
        "code": voucher.code.upper(),
        "bids": voucher.bids,
        "max_uses": voucher.max_uses,
        "times_used": 0,
        "used_by": [],
        "expires_at": voucher.expires_at,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"]
    }
    await db.vouchers.insert_one(voucher_doc)
    return {"message": "Voucher created", "voucher": {**voucher_doc, "_id": None}}

@api_router.get("/admin/vouchers")
async def get_all_vouchers(admin: dict = Depends(get_admin_user)):
    vouchers = await db.vouchers.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return vouchers

@api_router.delete("/admin/vouchers/{voucher_id}")
async def delete_voucher(voucher_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.vouchers.delete_one({"id": voucher_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return {"message": "Voucher deleted"}

@api_router.put("/admin/vouchers/{voucher_id}/toggle")
async def toggle_voucher(voucher_id: str, admin: dict = Depends(get_admin_user)):
    voucher = await db.vouchers.find_one({"id": voucher_id}, {"_id": 0})
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    new_status = not voucher.get("is_active", True)
    await db.vouchers.update_one({"id": voucher_id}, {"$set": {"is_active": new_status}})
    return {"message": f"Voucher active status set to {new_status}"}

@api_router.post("/vouchers/redeem")
async def redeem_voucher(data: VoucherRedeem, user: dict = Depends(get_current_user)):
    code = data.code.upper().strip()
    
    # Find voucher
    voucher = await db.vouchers.find_one({"code": code}, {"_id": 0})
    if not voucher:
        raise HTTPException(status_code=404, detail="Gutscheincode nicht gefunden")
    
    # Check if active
    if not voucher.get("is_active", True):
        raise HTTPException(status_code=400, detail="Dieser Gutschein ist nicht mehr gültig")
    
    # Check expiry
    if voucher.get("expires_at"):
        expiry = datetime.fromisoformat(voucher["expires_at"].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=400, detail="Dieser Gutschein ist abgelaufen")
    
    # Check max uses
    if voucher["times_used"] >= voucher["max_uses"]:
        raise HTTPException(status_code=400, detail="Dieser Gutschein wurde bereits vollständig eingelöst")
    
    # Check if user already used this voucher
    if user["id"] in voucher.get("used_by", []):
        raise HTTPException(status_code=400, detail="Sie haben diesen Gutschein bereits verwendet")
    
    # Redeem voucher
    await db.vouchers.update_one(
        {"id": voucher["id"]},
        {
            "$inc": {"times_used": 1},
            "$push": {"used_by": user["id"]}
        }
    )
    
    # Add bids to user
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": voucher["bids"]}}
    )
    
    return {
        "message": f"Gutschein eingelöst! {voucher['bids']} Gebote wurden Ihrem Konto gutgeschrieben.",
        "bids_added": voucher["bids"]
    }

# ==================== AUTOBIDDER SYSTEM ====================

@api_router.post("/autobidder/create")
async def create_autobidder(data: AutobidderCreate, user: dict = Depends(get_current_user)):
    # Check if auction exists and is active
    auction = await db.auctions.find_one({"id": data.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    # Check if user already has autobidder for this auction
    existing = await db.autobidders.find_one({
        "user_id": user["id"],
        "auction_id": data.auction_id,
        "is_active": True
    })
    if existing:
        # Update existing autobidder
        await db.autobidders.update_one(
            {"id": existing["id"]},
            {"$set": {"max_price": data.max_price}}
        )
        return {"message": "Autobidder updated", "max_price": data.max_price}
    
    # Create new autobidder
    autobidder = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "auction_id": data.auction_id,
        "max_price": data.max_price,
        "is_active": True,
        "bids_placed": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.autobidders.insert_one(autobidder)
    
    return {"message": "Autobidder created", "autobidder_id": autobidder["id"]}

@api_router.get("/autobidder/my")
async def get_my_autobidders(user: dict = Depends(get_current_user)):
    autobidders = await db.autobidders.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with auction data
    for ab in autobidders:
        auction = await db.auctions.find_one({"id": ab["auction_id"]}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
            ab["auction"] = auction
            ab["product"] = product
    
    return autobidders

@api_router.delete("/autobidder/{autobidder_id}")
async def delete_autobidder(autobidder_id: str, user: dict = Depends(get_current_user)):
    result = await db.autobidders.delete_one({"id": autobidder_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Autobidder not found")
    return {"message": "Autobidder deleted"}

@api_router.put("/autobidder/{autobidder_id}/toggle")
async def toggle_autobidder(autobidder_id: str, user: dict = Depends(get_current_user)):
    autobidder = await db.autobidders.find_one({"id": autobidder_id, "user_id": user["id"]}, {"_id": 0})
    if not autobidder:
        raise HTTPException(status_code=404, detail="Autobidder not found")
    
    new_status = not autobidder.get("is_active", True)
    await db.autobidders.update_one({"id": autobidder_id}, {"$set": {"is_active": new_status}})
    return {"message": f"Autobidder active status set to {new_status}", "is_active": new_status}

# Function to process autobidders after a bid is placed
async def process_autobidders(auction_id: str, last_bidder_id: str):
    """Process all active autobidders for an auction after a bid"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction or auction["status"] != "active":
        return
    
    # Get all active autobidders for this auction except the last bidder
    autobidders = await db.autobidders.find({
        "auction_id": auction_id,
        "is_active": True,
        "user_id": {"$ne": last_bidder_id}
    }, {"_id": 0}).to_list(100)
    
    for ab in autobidders:
        # Check if max price allows another bid
        next_price = auction["current_price"] + auction["bid_increment"]
        if next_price <= ab["max_price"]:
            # Check user's bid balance
            user = await db.users.find_one({"id": ab["user_id"]}, {"_id": 0})
            if user and user.get("bids_balance", 0) >= 1 and not user.get("is_blocked", False):
                # Place automatic bid
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$inc": {"bids_balance": -1, "total_bids_placed": 1}}
                )
                
                new_end_time = datetime.now(timezone.utc) + timedelta(seconds=15)
                await db.auctions.update_one(
                    {"id": auction_id},
                    {
                        "$set": {
                            "current_price": next_price,
                            "end_time": new_end_time.isoformat(),
                            "last_bidder_id": user["id"],
                            "last_bidder_name": user["name"]
                        },
                        "$inc": {"total_bids": 1},
                        "$push": {
                            "bid_history": {
                                "user_id": user["id"],
                                "user_name": user["name"],
                                "price": next_price,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "is_autobid": True
                            }
                        }
                    }
                )
                
                # Update autobidder stats
                await db.autobidders.update_one(
                    {"id": ab["id"]},
                    {"$inc": {"bids_placed": 1}}
                )
                
                logger.info(f"Autobid placed by {user['name']} on auction {auction_id}")
                break  # Only one autobid per round
        else:
            # Deactivate autobidder if max price reached
            await db.autobidders.update_one(
                {"id": ab["id"]},
                {"$set": {"is_active": False}}
            )

# ==================== EDIT ENDPOINTS ====================

@api_router.put("/admin/products/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, admin: dict = Depends(get_admin_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return {"message": "Product updated", "product": updated}

@api_router.put("/admin/auctions/{auction_id}")
async def update_auction(auction_id: str, data: AuctionUpdate, admin: dict = Depends(get_admin_user)):
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    update_data = {}
    
    if data.duration_seconds:
        # Extend auction time from now
        new_end_time = datetime.now(timezone.utc) + timedelta(seconds=data.duration_seconds)
        update_data["end_time"] = new_end_time.isoformat()
    
    if data.start_time:
        # Update start time (for scheduled auctions)
        update_data["start_time"] = data.start_time
        # If start_time is in the future, set status to scheduled
        start = datetime.fromisoformat(data.start_time.replace('Z', '+00:00'))
        if start > datetime.now(timezone.utc):
            update_data["status"] = "scheduled"
    
    if data.end_time:
        # Explicitly set end time
        update_data["end_time"] = data.end_time
    
    if data.status:
        update_data["status"] = data.status
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.auctions.update_one({"id": auction_id}, {"$set": update_data})
    
    updated = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    return {"message": "Auction updated", "auction": updated}

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    # Check if email is being changed and if it's already in use
    if "email" in update_data and update_data["email"] != user["email"]:
        existing = await db.users.find_one({"email": update_data["email"]})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return {"message": "User updated", "user": updated}

# ==================== USER REFERRAL SYSTEM (Free Bids) ====================

# Configuration for referral rewards
REFERRAL_MIN_DEPOSIT = 5.00  # €5 minimum deposit required from referred friend
REFERRAL_REWARD_BIDS = 10    # Bids given to both referrer AND referee when qualified

# Reward tiers for inviting friends (based on QUALIFIED friends who deposited €5+)
REFERRAL_REWARDS = [
    {"friends": 1, "bids": 10},   # Updated: 10 bids for first qualified friend
    {"friends": 3, "bids": 35},   # 10 + 10 + 15
    {"friends": 5, "bids": 60},   # + 25
    {"friends": 10, "bids": 120}, # + 60
    {"friends": 25, "bids": 350}, # + 230
    {"friends": 50, "bids": 800}, # + 450
]

@api_router.get("/users/referrals")
async def get_user_referrals(user: dict = Depends(get_current_user)):
    """Get user's referral stats and link"""
    referral_code = user["id"][:8].upper()
    
    # Count ALL invited friends
    all_referred = await db.users.find(
        {"referred_by_user": user["id"]},
        {"_id": 0, "id": 1, "name": 1, "created_at": 1, "total_deposits": 1}
    ).to_list(length=100)
    
    invited_count = len(all_referred)
    
    # Count QUALIFIED friends (who deposited at least €5)
    qualified_count = sum(1 for u in all_referred if u.get("total_deposits", 0) >= REFERRAL_MIN_DEPOSIT)
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    bids_earned = user_data.get("referral_bids_earned", 0)
    
    return {
        "referral_code": referral_code,
        "referral_link": f"https://bidblitz.de/register?ref={referral_code}",
        "invited_friends": invited_count,
        "qualified_friends": qualified_count,
        "bids_earned": bids_earned,
        "min_deposit_required": REFERRAL_MIN_DEPOSIT,
        "reward_per_referral": REFERRAL_REWARD_BIDS,
        "reward_tiers": REFERRAL_REWARDS,
        "referred_users": [
            {
                "name": u.get("name", "Unbekannt"),
                "created_at": u.get("created_at"),
                "qualified": u.get("total_deposits", 0) >= REFERRAL_MIN_DEPOSIT,
                "deposit_progress": min(u.get("total_deposits", 0) / REFERRAL_MIN_DEPOSIT * 100, 100)
            }
            for u in all_referred
        ]
    }

async def process_user_referral_reward(referrer_id: str):
    """Check and award referral rewards based on QUALIFIED friend count (€5+ deposited)"""
    # Count QUALIFIED referred friends (those who deposited at least €5)
    qualified_count = await db.users.count_documents({
        "referred_by_user": referrer_id,
        "total_deposits": {"$gte": REFERRAL_MIN_DEPOSIT}
    })
    
    referrer = await db.users.find_one({"id": referrer_id})
    if not referrer:
        return 0
    
    current_earned = referrer.get("referral_bids_earned", 0)
    
    # Calculate total bids based on qualified friends
    total_bids = 0
    for tier in REFERRAL_REWARDS:
        if qualified_count >= tier["friends"]:
            total_bids = tier["bids"]
    
    # Award new bids if we reached a new tier
    new_bids = total_bids - current_earned
    if new_bids > 0:
        await db.users.update_one(
            {"id": referrer_id},
            {
                "$inc": {"bids_balance": new_bids},
                "$set": {
                    "referral_bids_earned": total_bids,
                    "referral_tier_reached": qualified_count
                }
            }
        )
        logger.info(f"Referral reward: {new_bids} bids for user {referrer_id} (qualified friends: {qualified_count})")
    
    return new_bids

async def process_referral_after_deposit(user_id: str, deposit_amount: float):
    """Called after a successful payment to check and award referral rewards"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    old_total = user.get("total_deposits", 0)
    new_total = old_total + deposit_amount
    
    # Update total deposits
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"total_deposits": new_total}}
    )
    
    # Check if this is the first time crossing the €5 threshold
    if old_total < REFERRAL_MIN_DEPOSIT and new_total >= REFERRAL_MIN_DEPOSIT:
        referred_by = user.get("referred_by_user")
        if referred_by:
            # Award bonus to the new user who just qualified
            await db.users.update_one(
                {"id": user_id},
                {"$inc": {"bids_balance": REFERRAL_REWARD_BIDS}}
            )
            logger.info(f"New user {user_id} qualified for referral bonus: +{REFERRAL_REWARD_BIDS} bids")
            
            # Process reward tiers for the referrer
            await process_user_referral_reward(referred_by)

# ==================== AFFILIATE SYSTEM ====================

def get_affiliate_tier(leads_this_month: int) -> dict:
    """Get the current commission tier based on leads this month"""
    for tier_name, tier in AFFILIATE_COMMISSIONS.items():
        if tier["min_leads"] <= leads_this_month <= tier["max_leads"]:
            return {"tier": tier_name, "commission": tier["commission"]}
    return {"tier": "tier1", "commission": AFFILIATE_COMMISSIONS["tier1"]["commission"]}

@api_router.post("/affiliates/register")
async def register_affiliate(data: AffiliateRegister, user: dict = Depends(get_current_user)):
    """Register as an affiliate partner"""
    # Check if user is already an affiliate
    existing = await db.affiliates.find_one({"user_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Sie sind bereits als Affiliate registriert")
    
    # Generate unique referral code
    import random
    import string
    referral_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    
    affiliate = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "name": data.name,
        "email": data.email,
        "referral_code": referral_code,
        "payment_method": data.payment_method,
        "payment_details": data.payment_details,
        "total_referrals": 0,
        "converted_leads": 0,  # Users who bought a package
        "pending_commission": 0.0,
        "paid_commission": 0.0,
        "referrals": [],  # List of referred user IDs
        "commissions": [],  # List of commission records
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.affiliates.insert_one(affiliate)
    affiliate.pop("_id", None)
    
    return {
        "message": "Erfolgreich als Affiliate registriert",
        "referral_code": referral_code,
        "referral_link": f"https://bidblitz.de/register?ref={referral_code}",
        "affiliate": affiliate
    }

@api_router.get("/affiliates/me")
async def get_my_affiliate_stats(user: dict = Depends(get_current_user)):
    """Get affiliate stats for current user"""
    affiliate = await db.affiliates.find_one({"user_id": user["id"]}, {"_id": 0})
    if not affiliate:
        raise HTTPException(status_code=404, detail="Sie sind nicht als Affiliate registriert")
    
    # Get leads this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    leads_this_month = await db.affiliate_leads.count_documents({
        "affiliate_id": affiliate["id"],
        "converted": True,
        "converted_at": {"$gte": month_start.isoformat()}
    })
    
    tier_info = get_affiliate_tier(leads_this_month)
    
    return {
        "affiliate": affiliate,
        "leads_this_month": leads_this_month,
        "current_tier": tier_info["tier"],
        "commission_rate": tier_info["commission"],
        "commission_tiers": AFFILIATE_COMMISSIONS
    }

@api_router.get("/affiliates/referral/{code}")
async def validate_referral_code(code: str):
    """Validate a referral code"""
    affiliate = await db.affiliates.find_one({"referral_code": code, "status": "active"}, {"_id": 0})
    if not affiliate:
        return {"valid": False}
    
    return {
        "valid": True,
        "affiliate_name": affiliate["name"]
    }

@api_router.post("/affiliates/track-referral")
async def track_referral(referral_code: str, referred_user_id: str):
    """Track a new referral (called internally when user registers with ref code)"""
    affiliate = await db.affiliates.find_one({"referral_code": referral_code})
    if not affiliate:
        return {"tracked": False}
    
    # Create lead record
    lead = {
        "id": str(uuid.uuid4()),
        "affiliate_id": affiliate["id"],
        "user_id": referred_user_id,
        "referral_code": referral_code,
        "converted": False,
        "conversion_amount": 0,
        "commission_earned": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "converted_at": None
    }
    
    await db.affiliate_leads.insert_one(lead)
    
    # Update affiliate stats
    await db.affiliates.update_one(
        {"id": affiliate["id"]},
        {
            "$inc": {"total_referrals": 1},
            "$push": {"referrals": referred_user_id}
        }
    )
    
    # Store referral code on user
    await db.users.update_one(
        {"id": referred_user_id},
        {"$set": {"referred_by": referral_code, "affiliate_id": affiliate["id"]}}
    )
    
    return {"tracked": True, "affiliate_id": affiliate["id"]}

async def process_affiliate_commission(user_id: str, purchase_amount: float):
    """Process affiliate commission when a referred user makes a purchase"""
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("affiliate_id"):
        return None
    
    affiliate_id = user["affiliate_id"]
    affiliate = await db.affiliates.find_one({"id": affiliate_id})
    if not affiliate:
        return None
    
    # Check if this is the first purchase (conversion)
    lead = await db.affiliate_leads.find_one({
        "affiliate_id": affiliate_id,
        "user_id": user_id,
        "converted": False
    })
    
    if not lead:
        # Already converted or not a lead
        return None
    
    # Get current month's leads for tier calculation
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    leads_this_month = await db.affiliate_leads.count_documents({
        "affiliate_id": affiliate_id,
        "converted": True,
        "converted_at": {"$gte": month_start.isoformat()}
    })
    
    tier_info = get_affiliate_tier(leads_this_month + 1)
    commission = max(AFFILIATE_BASE_COMMISSION, tier_info["commission"])
    
    # Update lead as converted
    await db.affiliate_leads.update_one(
        {"id": lead["id"]},
        {"$set": {
            "converted": True,
            "conversion_amount": purchase_amount,
            "commission_earned": commission,
            "converted_at": now.isoformat()
        }}
    )
    
    # Update affiliate stats
    await db.affiliates.update_one(
        {"id": affiliate_id},
        {
            "$inc": {
                "converted_leads": 1,
                "pending_commission": commission
            },
            "$push": {
                "commissions": {
                    "id": str(uuid.uuid4()),
                    "lead_id": lead["id"],
                    "user_id": user_id,
                    "amount": commission,
                    "purchase_amount": purchase_amount,
                    "tier": tier_info["tier"],
                    "status": "pending",
                    "created_at": now.isoformat()
                }
            }
        }
    )
    
    logger.info(f"Affiliate commission: €{commission} for affiliate {affiliate_id}, lead {user_id}")
    return commission

# Admin: View all affiliates
@api_router.get("/admin/affiliates")
async def get_all_affiliates(admin: dict = Depends(get_admin_user)):
    """Get all affiliates (admin only)"""
    affiliates = await db.affiliates.find({}, {"_id": 0}).to_list(1000)
    return affiliates

# Admin: Payout affiliate commission
@api_router.post("/admin/affiliates/{affiliate_id}/payout")
async def payout_affiliate(affiliate_id: str, amount: float, admin: dict = Depends(get_admin_user)):
    """Mark affiliate commission as paid"""
    affiliate = await db.affiliates.find_one({"id": affiliate_id})
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    
    if amount > affiliate["pending_commission"]:
        raise HTTPException(status_code=400, detail="Amount exceeds pending commission")
    
    # Record payout
    payout = {
        "id": str(uuid.uuid4()),
        "affiliate_id": affiliate_id,
        "amount": amount,
        "payment_method": affiliate["payment_method"],
        "payment_details": affiliate["payment_details"],
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": admin["id"]
    }
    
    await db.affiliate_payouts.insert_one(payout)
    
    # Update affiliate balance
    await db.affiliates.update_one(
        {"id": affiliate_id},
        {
            "$inc": {
                "pending_commission": -amount,
                "paid_commission": amount
            }
        }
    )
    
    return {"message": f"€{amount:.2f} ausgezahlt", "payout": payout}

# ==================== ADMIN BOT SYSTEM ====================

# Default bot names (German names)
DEFAULT_BOT_NAMES = [
    "Maria K.", "Thomas M.", "Sandra W.", "Michael B.", "Julia H.",
    "Stefan R.", "Anna S.", "Christian P.", "Lisa M.", "Markus F.",
    "Nina L.", "Daniel K.", "Laura B.", "Tobias G.", "Sarah N.",
    "Florian W.", "Katharina S.", "Maximilian H.", "Jennifer R.", "Patrick M."
]

@api_router.post("/admin/bots")
async def create_bot(data: BotCreate, admin: dict = Depends(get_admin_user)):
    """Create a new bid bot"""
    bot = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "is_active": True,
        "total_bids_placed": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"]
    }
    await db.bots.insert_one(bot)
    return {"message": "Bot created", "bot": {**bot, "_id": None}}

@api_router.get("/admin/bots")
async def get_all_bots(admin: dict = Depends(get_admin_user)):
    """Get all bots"""
    bots = await db.bots.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return bots

@api_router.delete("/admin/bots/{bot_id}")
async def delete_bot(bot_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a bot"""
    result = await db.bots.delete_one({"id": bot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"message": "Bot deleted"}

@api_router.post("/admin/bots/seed")
async def seed_bots(admin: dict = Depends(get_admin_user)):
    """Create 20 new bots with unique names"""
    import random
    
    # Extended name pool for more variety
    first_names = [
        "Max", "Anna", "Leon", "Sophie", "Paul", "Emma", "Luca", "Mia", "Felix", "Hannah",
        "Jonas", "Lea", "Tim", "Laura", "David", "Julia", "Simon", "Sarah", "Niklas", "Lisa",
        "Jan", "Marie", "Tom", "Lena", "Lukas", "Nele", "Ben", "Clara", "Erik", "Amelie",
        "Moritz", "Emily", "Julian", "Johanna", "Finn", "Maja", "Noah", "Alina", "Elias", "Zoe",
        "Bardh", "Arben", "Drita", "Fatmir", "Genta", "Hana", "Ilir", "Kaltrina", "Liridon", "Majlinda",
        "Stefan", "Peter", "Michael", "Thomas", "Andreas", "Matthias", "Jens", "Marco", "Sascha", "Frank",
        "Sabine", "Petra", "Monika", "Karin", "Susanne", "Birgit", "Claudia", "Heike", "Andrea", "Martina"
    ]
    
    last_initials = ["K.", "M.", "S.", "L.", "H.", "B.", "W.", "R.", "F.", "T.", "N.", "P.", "G.", "D.", "J.", "A.", "E.", "V.", "Z.", "C."]
    
    created = 0
    for _ in range(20):
        # Generate unique name
        for attempt in range(50):  # Max 50 attempts to find unique name
            name = f"{random.choice(first_names)} {random.choice(last_initials)}"
            existing = await db.bots.find_one({"name": name})
            if not existing:
                bot = {
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "is_bot": True,
                    "total_bids_placed": 0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin["id"]
                }
                await db.bots.insert_one(bot)
                created += 1
                break
    
    total = await db.bots.count_documents({})
    return {"message": f"{created} neue Bots erstellt", "total": total, "created": created}

@api_router.post("/admin/bots/bid")
async def bot_place_bid(data: BotBidRequest, admin: dict = Depends(get_admin_user)):
    """Make a bot place a single bid on an auction"""
    # Verify bot exists
    bot = await db.bots.find_one({"id": data.bot_id}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Verify auction exists and is active
    auction = await db.auctions.find_one({"id": data.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    # Place bot bid
    new_price = auction["current_price"] + auction["bid_increment"]
    new_end_time = datetime.now(timezone.utc) + timedelta(seconds=15)
    
    await db.auctions.update_one(
        {"id": data.auction_id},
        {
            "$set": {
                "current_price": new_price,
                "end_time": new_end_time.isoformat(),
                "last_bidder_id": f"bot_{bot['id']}",
                "last_bidder_name": bot["name"]
            },
            "$inc": {"total_bids": 1},
            "$push": {
                "bid_history": {
                    "user_id": f"bot_{bot['id']}",
                    "user_name": bot["name"],
                    "price": new_price,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "is_bot": True
                }
            }
        }
    )
    
    # Update bot stats
    await db.bots.update_one(
        {"id": bot["id"]},
        {"$inc": {"total_bids_placed": 1}}
    )
    
    return {
        "message": f"Bot '{bot['name']}' placed bid",
        "new_price": new_price,
        "bot_name": bot["name"]
    }

@api_router.post("/admin/bots/auto-bid")
async def bot_auto_bid(data: BotBidRequest, admin: dict = Depends(get_admin_user)):
    """Start automatic bot bidding to reach target price"""
    import asyncio
    
    # Verify bot exists
    bot = await db.bots.find_one({"id": data.bot_id}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Verify auction exists
    auction = await db.auctions.find_one({"id": data.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if not data.target_price and not data.num_bids:
        raise HTTPException(status_code=400, detail="Either target_price or num_bids must be specified")
    
    # Calculate number of bids needed
    if data.target_price:
        current = auction["current_price"]
        increment = auction["bid_increment"]
        num_bids = int((data.target_price - current) / increment)
    else:
        num_bids = data.num_bids
    
    if num_bids <= 0:
        raise HTTPException(status_code=400, detail="Target price already reached or invalid")
    
    # Get all bots for rotation
    all_bots = await db.bots.find({"is_active": True}, {"_id": 0}).to_list(100)
    if not all_bots:
        all_bots = [bot]
    
    # Create bot bid task record
    task_id = str(uuid.uuid4())
    task = {
        "id": task_id,
        "auction_id": data.auction_id,
        "target_price": data.target_price,
        "num_bids": num_bids,
        "bids_placed": 0,
        "status": "running",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"]
    }
    await db.bot_tasks.insert_one(task)
    
    return {
        "message": f"Bot auto-bidding started",
        "task_id": task_id,
        "planned_bids": num_bids,
        "target_price": data.target_price
    }

@api_router.post("/admin/bots/execute-bids")
async def execute_bot_bids(auction_id: str, num_bids: int = 5, admin: dict = Depends(get_admin_user)):
    """Execute multiple bot bids immediately with random bot rotation"""
    import random
    
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    # Get all active bots
    bots = await db.bots.find({"is_active": True}, {"_id": 0}).to_list(100)
    if not bots:
        raise HTTPException(status_code=400, detail="No active bots. Create bots first.")
    
    current_price = auction["current_price"]
    increment = auction["bid_increment"]
    bids_placed = 0
    
    for i in range(num_bids):
        # Select random bot (avoid same bot twice in a row)
        bot = random.choice(bots)
        
        new_price = current_price + increment
        new_end_time = datetime.now(timezone.utc) + timedelta(seconds=15)
        
        await db.auctions.update_one(
            {"id": auction_id},
            {
                "$set": {
                    "current_price": new_price,
                    "end_time": new_end_time.isoformat(),
                    "last_bidder_id": f"bot_{bot['id']}",
                    "last_bidder_name": bot["name"]
                },
                "$inc": {"total_bids": 1},
                "$push": {
                    "bid_history": {
                        "user_id": f"bot_{bot['id']}",
                        "user_name": bot["name"],
                        "price": new_price,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "is_bot": True
                    }
                }
            }
        )
        
        await db.bots.update_one(
            {"id": bot["id"]},
            {"$inc": {"total_bids_placed": 1}}
        )
        
        current_price = new_price
        bids_placed += 1
    
    return {
        "message": f"{bids_placed} bot bids placed",
        "new_price": current_price,
        "bids_placed": bids_placed
    }

@api_router.post("/admin/bots/bid-to-price")
async def bot_bid_to_price(auction_id: str, target_price: float, admin: dict = Depends(get_admin_user)):
    """Make bots bid until target price is reached"""
    import random
    
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    if target_price <= auction["current_price"]:
        raise HTTPException(status_code=400, detail="Target price must be higher than current price")
    
    # Get all active bots
    bots = await db.bots.find({"is_active": True}, {"_id": 0}).to_list(100)
    if not bots:
        raise HTTPException(status_code=400, detail="No active bots. Create bots first.")
    
    current_price = auction["current_price"]
    increment = auction["bid_increment"]
    bids_placed = 0
    last_bot = None
    
    while current_price < target_price:
        # Select random bot (avoid same bot twice in a row if possible)
        available_bots = [b for b in bots if b["id"] != (last_bot["id"] if last_bot else None)]
        if not available_bots:
            available_bots = bots
        bot = random.choice(available_bots)
        last_bot = bot
        
        new_price = round(current_price + increment, 2)
        new_end_time = datetime.now(timezone.utc) + timedelta(seconds=15)
        
        await db.auctions.update_one(
            {"id": auction_id},
            {
                "$set": {
                    "current_price": new_price,
                    "end_time": new_end_time.isoformat(),
                    "last_bidder_id": f"bot_{bot['id']}",
                    "last_bidder_name": bot["name"]
                },
                "$inc": {"total_bids": 1},
                "$push": {
                    "bid_history": {
                        "user_id": f"bot_{bot['id']}",
                        "user_name": bot["name"],
                        "price": new_price,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "is_bot": True
                    }
                }
            }
        )
        
        await db.bots.update_one(
            {"id": bot["id"]},
            {"$inc": {"total_bids_placed": 1}}
        )
        
        current_price = new_price
        bids_placed += 1
        
        # Safety limit
        if bids_placed >= 1000:
            break
    
    return {
        "message": f"Price increased to €{current_price:.2f}",
        "final_price": current_price,
        "bids_placed": bids_placed,
        "target_reached": current_price >= target_price
    }

# ==================== BUY IT NOW (SOFORT KAUFEN) ====================

@api_router.post("/auctions/{auction_id}/buy-now")
async def buy_now(auction_id: str, user: dict = Depends(get_current_user)):
    """Buy the product immediately at retail price, with bid credits applied"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auktion ist nicht mehr aktiv")
    
    product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    retail_price = product.get("retail_price", 0)
    
    # Calculate bid credits: count user's bids in this auction
    bid_history = auction.get("bid_history", [])
    user_bids = [b for b in bid_history if b.get("user_id") == user["id"]]
    bid_credit = len(user_bids) * 0.15  # Each bid worth €0.15 credit
    
    # Final price after bid credit
    final_price = max(0, retail_price - bid_credit)
    
    # Create buy-now order
    order = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "auction_id": auction_id,
        "product_id": product["id"],
        "product_name": product.get("name"),
        "retail_price": retail_price,
        "bid_credit": round(bid_credit, 2),
        "final_price": round(final_price, 2),
        "bids_used": len(user_bids),
        "type": "buy_now",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)
    
    # End the auction
    await db.auctions.update_one(
        {"id": auction_id},
        {
            "$set": {
                "status": "ended",
                "winner_id": user["id"],
                "winner_name": user["name"],
                "buy_now_used": True,
                "ended_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "order_id": order["id"],
        "product_name": product.get("name"),
        "retail_price": retail_price,
        "bid_credit": round(bid_credit, 2),
        "bids_used": len(user_bids),
        "final_price": round(final_price, 2),
        "message": f"Produkt für €{final_price:.2f} gekauft! (€{bid_credit:.2f} Guthaben aus {len(user_bids)} Geboten)"
    }

@api_router.get("/auctions/{auction_id}/buy-now-price")
async def get_buy_now_price(auction_id: str, user: dict = Depends(get_current_user)):
    """Get the buy-now price with user's bid credits"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    retail_price = product.get("retail_price", 0)
    
    # Calculate bid credits
    bid_history = auction.get("bid_history", [])
    user_bids = [b for b in bid_history if b.get("user_id") == user["id"]]
    bid_credit = len(user_bids) * 0.15
    final_price = max(0, retail_price - bid_credit)
    
    return {
        "retail_price": retail_price,
        "bid_credit": round(bid_credit, 2),
        "bids_used": len(user_bids),
        "final_price": round(final_price, 2)
    }

# ==================== AUCTION TYPES ====================

@api_router.get("/auctions/beginner")
async def get_beginner_auctions():
    """Get auctions only for beginners (users with < 10 wins)"""
    auctions = await db.auctions.find({
        "status": "active",
        "auction_type": "beginner"
    }, {"_id": 0}).to_list(50)
    
    for auction in auctions:
        product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
        auction["product"] = product
    
    return auctions

@api_router.get("/auctions/night")
async def get_night_auctions():
    """Get night auctions (22:00 - 06:00)"""
    auctions = await db.auctions.find({
        "status": "active",
        "auction_type": "night"
    }, {"_id": 0}).to_list(50)
    
    for auction in auctions:
        product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
        auction["product"] = product
    
    return auctions

@api_router.get("/auctions/free")
async def get_free_auctions():
    """Get free auctions (no bids needed, just time)"""
    auctions = await db.auctions.find({
        "status": "active",
        "auction_type": "free"
    }, {"_id": 0}).to_list(50)
    
    for auction in auctions:
        product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
        auction["product"] = product
    
    return auctions

# ==================== WISHLIST & NOTIFICATIONS ====================

@api_router.post("/wishlist/add")
async def add_to_wishlist(request: WishlistRequest, user: dict = Depends(get_current_user)):
    """Add product or category to wishlist for notifications"""
    wishlist_item = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "product_id": request.product_id,
        "category": request.category,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notified": False
    }
    await db.wishlist.insert_one(wishlist_item)
    return {"message": "Zur Wunschliste hinzugefügt", "id": wishlist_item["id"]}

@api_router.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    """Get user's wishlist"""
    items = await db.wishlist.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    
    # Enrich with product data
    for item in items:
        if item.get("product_id"):
            product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
            item["product"] = product
    
    return items

@api_router.delete("/wishlist/{item_id}")
async def remove_from_wishlist(item_id: str, user: dict = Depends(get_current_user)):
    """Remove item from wishlist"""
    result = await db.wishlist.delete_one({"id": item_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item nicht gefunden")
    return {"message": "Von Wunschliste entfernt"}

# ==================== ACHIEVEMENTS & GAMIFICATION ====================

ACHIEVEMENTS = {
    "first_win": {"name": "Erster Sieg", "description": "Gewinne deine erste Auktion", "icon": "trophy", "points": 10},
    "wins_10": {"name": "Gewinner", "description": "Gewinne 10 Auktionen", "icon": "star", "points": 50},
    "wins_50": {"name": "Profi-Bieter", "description": "Gewinne 50 Auktionen", "icon": "crown", "points": 200},
    "night_owl": {"name": "Nachteule", "description": "Gewinne eine Auktion nach Mitternacht", "icon": "moon", "points": 25},
    "early_bird": {"name": "Frühaufsteher", "description": "Gewinne eine Auktion vor 7 Uhr", "icon": "sun", "points": 25},
    "big_spender": {"name": "Großeinkäufer", "description": "Kaufe 500+ Gebote", "icon": "gem", "points": 100},
    "streak_7": {"name": "Wochenstreak", "description": "7 Tage hintereinander aktiv", "icon": "flame", "points": 50},
    "streak_30": {"name": "Monatsstreak", "description": "30 Tage hintereinander aktiv", "icon": "fire", "points": 200},
    "social_sharer": {"name": "Social Star", "description": "Teile einen Gewinn auf Social Media", "icon": "share", "points": 15},
    "first_bid": {"name": "Einsteiger", "description": "Platziere dein erstes Gebot", "icon": "zap", "points": 5},
    "bids_100": {"name": "Fleißiger Bieter", "description": "Platziere 100 Gebote", "icon": "target", "points": 30},
    "referral_1": {"name": "Botschafter", "description": "Lade einen Freund ein", "icon": "users", "points": 20},
}

@api_router.get("/achievements")
async def get_achievements(user: dict = Depends(get_current_user)):
    """Get user's achievements"""
    user_achievements = await db.achievements.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    unlocked_ids = [a["achievement_id"] for a in user_achievements]
    
    result = []
    for ach_id, ach_data in ACHIEVEMENTS.items():
        result.append({
            "id": ach_id,
            **ach_data,
            "unlocked": ach_id in unlocked_ids,
            "unlocked_at": next((a["unlocked_at"] for a in user_achievements if a["achievement_id"] == ach_id), None)
        })
    
    total_points = sum(ACHIEVEMENTS[a]["points"] for a in unlocked_ids if a in ACHIEVEMENTS)
    
    return {
        "achievements": result,
        "total_points": total_points,
        "unlocked_count": len(unlocked_ids),
        "total_count": len(ACHIEVEMENTS)
    }

async def check_and_award_achievement(user_id: str, achievement_id: str):
    """Award achievement to user if not already unlocked"""
    existing = await db.achievements.find_one({"user_id": user_id, "achievement_id": achievement_id})
    if existing:
        return None
    
    if achievement_id not in ACHIEVEMENTS:
        return None
    
    achievement = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "achievement_id": achievement_id,
        "unlocked_at": datetime.now(timezone.utc).isoformat()
    }
    await db.achievements.insert_one(achievement)
    
    # Add bonus bids for achievement
    bonus_bids = ACHIEVEMENTS[achievement_id]["points"] // 10  # 1 bid per 10 points
    if bonus_bids > 0:
        await db.users.update_one({"id": user_id}, {"$inc": {"bids_balance": bonus_bids}})
    
    return {**ACHIEVEMENTS[achievement_id], "bonus_bids": bonus_bids}

# ==================== DAILY LOGIN REWARDS ====================

@api_router.post("/daily-reward")
async def claim_daily_reward(user: dict = Depends(get_current_user)):
    """Claim daily login reward"""
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Check if already claimed today
    existing = await db.daily_rewards.find_one({
        "user_id": user["id"],
        "date": today
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Tagesbelohnung bereits abgeholt")
    
    # Get user's streak
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    current_streak = user_data.get("login_streak", 0)
    last_claim = user_data.get("last_daily_claim")
    
    # Check if streak continues
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    if last_claim == yesterday:
        current_streak += 1
    else:
        current_streak = 1
    
    # Calculate reward based on streak (1-5 bids)
    reward_bids = min(5, current_streak)
    
    # Bonus for streak milestones
    bonus = 0
    if current_streak == 7:
        bonus = 10  # Week streak bonus
        await check_and_award_achievement(user["id"], "streak_7")
    elif current_streak == 30:
        bonus = 50  # Month streak bonus
        await check_and_award_achievement(user["id"], "streak_30")
    
    total_reward = reward_bids + bonus
    
    # Save reward claim
    await db.daily_rewards.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "date": today,
        "bids_earned": total_reward,
        "streak": current_streak
    })
    
    # Update user
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {"bids_balance": total_reward},
            "$set": {
                "login_streak": current_streak,
                "last_daily_claim": today
            }
        }
    )
    
    return {
        "bids_earned": total_reward,
        "streak": current_streak,
        "bonus": bonus,
        "message": f"+{total_reward} Gebote! Streak: {current_streak} Tage"
    }

@api_router.get("/daily-reward/status")
async def get_daily_reward_status(user: dict = Depends(get_current_user)):
    """Check daily reward status"""
    today = datetime.now(timezone.utc).date().isoformat()
    
    existing = await db.daily_rewards.find_one({
        "user_id": user["id"],
        "date": today
    })
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    current_streak = user_data.get("login_streak", 0)
    
    return {
        "claimed_today": existing is not None,
        "current_streak": current_streak,
        "next_reward": min(5, current_streak + 1) if not existing else 0
    }

# ==================== USER STATISTICS ====================

@api_router.get("/stats/me")
async def get_user_stats(user: dict = Depends(get_current_user)):
    """Get detailed user statistics"""
    user_id = user["id"]
    
    # Get all user's bids from auctions
    all_auctions = await db.auctions.find({}, {"_id": 0, "bid_history": 1, "product_id": 1, "winner_id": 1, "status": 1}).to_list(10000)
    
    total_bids = 0
    bids_by_category = {}
    wins_by_category = {}
    bids_by_hour = [0] * 24
    
    for auction in all_auctions:
        bid_history = auction.get("bid_history", [])
        user_bids = [b for b in bid_history if b.get("user_id") == user_id]
        total_bids += len(user_bids)
        
        # Get product category
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0, "category": 1})
        category = product.get("category", "Sonstige") if product else "Sonstige"
        
        bids_by_category[category] = bids_by_category.get(category, 0) + len(user_bids)
        
        # Track wins
        if auction.get("winner_id") == user_id:
            wins_by_category[category] = wins_by_category.get(category, 0) + 1
        
        # Track bid times
        for bid in user_bids:
            try:
                bid_time = datetime.fromisoformat(bid["timestamp"].replace("Z", "+00:00"))
                bids_by_hour[bid_time.hour] += 1
            except:
                pass
    
    # Calculate win rate
    total_wins = len(user.get("won_auctions", []))
    auctions_participated = len(set(a["id"] for a in all_auctions if any(b.get("user_id") == user_id for b in a.get("bid_history", [])) for a in [auction]))
    win_rate = (total_wins / auctions_participated * 100) if auctions_participated > 0 else 0
    
    # Best time to bid (hour with most wins)
    best_hour = bids_by_hour.index(max(bids_by_hour)) if any(bids_by_hour) else 12
    
    # Best category
    best_category = max(wins_by_category, key=wins_by_category.get) if wins_by_category else None
    
    return {
        "total_bids": total_bids,
        "total_wins": total_wins,
        "win_rate": round(win_rate, 1),
        "bids_by_category": bids_by_category,
        "wins_by_category": wins_by_category,
        "bids_by_hour": bids_by_hour,
        "best_hour": best_hour,
        "best_category": best_category,
        "member_since": user.get("created_at"),
        "total_spent": user.get("total_deposits", 0)
    }

# ==================== VIP MEMBERSHIP ====================

VIP_PLANS = {
    "monthly": {"price": 9.99, "duration_days": 30, "bid_discount": 10, "free_bids": 20},
    "yearly": {"price": 79.99, "duration_days": 365, "bid_discount": 15, "free_bids": 300}
}

@api_router.get("/vip/plans")
async def get_vip_plans():
    """Get available VIP plans"""
    return VIP_PLANS

@api_router.get("/vip/status")
async def get_vip_status(user: dict = Depends(get_current_user)):
    """Get user's VIP status"""
    vip = await db.vip_memberships.find_one({
        "user_id": user["id"],
        "status": "active"
    }, {"_id": 0})
    
    if vip:
        expires = datetime.fromisoformat(vip["expires_at"].replace("Z", "+00:00"))
        days_left = (expires - datetime.now(timezone.utc)).days
        return {
            "is_vip": True,
            "plan": vip["plan"],
            "expires_at": vip["expires_at"],
            "days_left": max(0, days_left),
            "bid_discount": VIP_PLANS[vip["plan"]]["bid_discount"]
        }
    
    return {"is_vip": False}

@api_router.post("/vip/subscribe")
async def subscribe_vip(plan: str, user: dict = Depends(get_current_user)):
    """Subscribe to VIP membership"""
    if plan not in VIP_PLANS:
        raise HTTPException(status_code=400, detail="Ungültiger Plan")
    
    plan_data = VIP_PLANS[plan]
    expires_at = datetime.now(timezone.utc) + timedelta(days=plan_data["duration_days"])
    
    # Create or extend membership
    existing = await db.vip_memberships.find_one({"user_id": user["id"], "status": "active"})
    
    if existing:
        # Extend existing
        current_expires = datetime.fromisoformat(existing["expires_at"].replace("Z", "+00:00"))
        new_expires = current_expires + timedelta(days=plan_data["duration_days"])
        await db.vip_memberships.update_one(
            {"id": existing["id"]},
            {"$set": {"expires_at": new_expires.isoformat(), "plan": plan}}
        )
    else:
        # Create new
        membership = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "plan": plan,
            "status": "active",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat(),
            "price_paid": plan_data["price"]
        }
        await db.vip_memberships.insert_one(membership)
    
    # Add free bids
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": plan_data["free_bids"]}}
    )
    
    return {
        "message": f"VIP {plan} aktiviert!",
        "expires_at": expires_at.isoformat(),
        "free_bids": plan_data["free_bids"],
        "bid_discount": plan_data["bid_discount"]
    }

# ==================== LIVE CHAT SUPPORT ====================

@api_router.post("/chat/send")
async def send_chat_message(message: ChatMessage, user: dict = Depends(get_current_user)):
    """Send a chat message to support"""
    chat_msg = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "message": message.message,
        "auction_id": message.auction_id,
        "is_admin": False,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chat_messages.insert_one(chat_msg)
    
    return {"message": "Nachricht gesendet", "id": chat_msg["id"]}

@api_router.get("/chat/messages")
async def get_chat_messages(user: dict = Depends(get_current_user)):
    """Get user's chat messages"""
    messages = await db.chat_messages.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return messages

@api_router.get("/admin/chat/all")
async def get_all_chat_messages(admin: dict = Depends(get_admin_user)):
    """Get all chat messages (admin only)"""
    messages = await db.chat_messages.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(200).to_list(200)
    
    return messages

@api_router.post("/admin/chat/reply")
async def admin_reply_chat(user_id: str, message: str, admin: dict = Depends(get_admin_user)):
    """Admin reply to chat"""
    chat_msg = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": "Support",
        "user_email": "support@bidblitz.de",
        "message": message,
        "is_admin": True,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chat_messages.insert_one(chat_msg)
    
    return {"message": "Antwort gesendet", "id": chat_msg["id"]}

# ==================== PDF INVOICE GENERATION ====================

def generate_invoice_pdf(purchase: dict, user: dict) -> io.BytesIO:
    """Generate a PDF invoice for a purchase"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#FFD700'), alignment=TA_CENTER)
    normal_style = styles['Normal']
    right_style = ParagraphStyle('Right', parent=styles['Normal'], alignment=TA_RIGHT)
    
    elements = []
    
    # Header
    elements.append(Paragraph("BidBlitz", title_style))
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph("RECHNUNG / INVOICE", ParagraphStyle('Subtitle', fontSize=14, textColor=colors.grey, alignment=TA_CENTER)))
    elements.append(Spacer(1, 1*cm))
    
    # Invoice Details
    invoice_date = datetime.fromisoformat(purchase.get("created_at", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00"))
    invoice_number = f"INV-{invoice_date.strftime('%Y%m%d')}-{purchase.get('id', 'XXX')[:8].upper()}"
    
    invoice_data = [
        ["Rechnungsnummer:", invoice_number],
        ["Rechnungsdatum:", invoice_date.strftime("%d.%m.%Y")],
        ["Kunde:", user.get("name", "Unbekannt")],
        ["E-Mail:", user.get("email", "")],
    ]
    
    invoice_table = Table(invoice_data, colWidths=[5*cm, 10*cm])
    invoice_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(invoice_table)
    elements.append(Spacer(1, 1*cm))
    
    # Line Items
    package_name = purchase.get("package_name", "Gebotspaket")
    bids = purchase.get("bids", 0)
    amount = purchase.get("amount", 0)
    
    # Calculate net and VAT (19% German VAT)
    vat_rate = 0.19
    net_amount = amount / (1 + vat_rate)
    vat_amount = amount - net_amount
    
    items_data = [
        ["Beschreibung", "Menge", "Einzelpreis", "Gesamt"],
        [f"{package_name}\n({bids} Gebote)", "1", f"€{net_amount:.2f}", f"€{net_amount:.2f}"],
    ]
    
    items_table = Table(items_data, colWidths=[8*cm, 2*cm, 3*cm, 3*cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#181824')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # Totals
    totals_data = [
        ["", "", "Nettobetrag:", f"€{net_amount:.2f}"],
        ["", "", "MwSt. (19%):", f"€{vat_amount:.2f}"],
        ["", "", "Gesamtbetrag:", f"€{amount:.2f}"],
    ]
    
    totals_table = Table(totals_data, colWidths=[8*cm, 2*cm, 3*cm, 3*cm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (2, -1), (-1, -1), 'Helvetica-Bold'),
        ('LINEABOVE', (2, -1), (-1, -1), 1, colors.black),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 2*cm))
    
    # Footer
    footer_text = """
    <para align="center">
    <font size="9" color="grey">
    BidBlitz GmbH • Musterstraße 123 • 10115 Berlin<br/>
    USt-IdNr.: DE123456789 • Handelsregister: HRB 12345<br/>
    support@bidblitz.de • www.bidblitz.de
    </font>
    </para>
    """
    elements.append(Paragraph(footer_text, styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

@api_router.get("/invoices/{purchase_id}/download")
async def download_invoice(purchase_id: str, user: dict = Depends(get_current_user)):
    """Download PDF invoice for a purchase"""
    purchase = await db.purchases.find_one({"id": purchase_id, "user_id": user["id"]}, {"_id": 0})
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Kauf nicht gefunden")
    
    pdf_buffer = generate_invoice_pdf(purchase, user)
    
    invoice_date = datetime.fromisoformat(purchase.get("created_at", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00"))
    filename = f"BidBlitz_Rechnung_{invoice_date.strftime('%Y%m%d')}_{purchase_id[:8]}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/invoices")
async def get_user_invoices(user: dict = Depends(get_current_user)):
    """Get all user's invoices"""
    purchases = await db.purchases.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    invoices = []
    for p in purchases:
        invoice_date = datetime.fromisoformat(p.get("created_at", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00"))
        invoices.append({
            "id": p["id"],
            "invoice_number": f"INV-{invoice_date.strftime('%Y%m%d')}-{p['id'][:8].upper()}",
            "date": p.get("created_at"),
            "amount": p.get("amount"),
            "package_name": p.get("package_name"),
            "bids": p.get("bids"),
            "download_url": f"/api/invoices/{p['id']}/download"
        })
    
    return invoices

# ==================== SOCIAL SHARING ====================

@api_router.post("/share/win/{auction_id}")
async def share_win(auction_id: str, platform: str, user: dict = Depends(get_current_user)):
    """Record social share and award bonus"""
    auction = await db.auctions.find_one({"id": auction_id, "winner_id": user["id"]}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Gewonnene Auktion nicht gefunden")
    
    # Check if already shared
    existing = await db.social_shares.find_one({
        "user_id": user["id"],
        "auction_id": auction_id
    })
    
    if existing:
        return {"message": "Bereits geteilt", "bonus_bids": 0}
    
    # Record share
    share = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "auction_id": auction_id,
        "platform": platform,  # facebook, twitter, whatsapp, etc.
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.social_shares.insert_one(share)
    
    # Award bonus bids
    bonus_bids = 3
    await db.users.update_one({"id": user["id"]}, {"$inc": {"bids_balance": bonus_bids}})
    
    # Award achievement
    await check_and_award_achievement(user["id"], "social_sharer")
    
    return {"message": f"Danke fürs Teilen! +{bonus_bids} Bonus-Gebote", "bonus_bids": bonus_bids}

# ==================== LEADERBOARD ====================

@api_router.get("/leaderboard")
async def get_leaderboard(period: str = "all"):
    """Get top winners leaderboard"""
    # Get all users with wins
    users = await db.users.find(
        {"is_admin": False},
        {"_id": 0, "id": 1, "name": 1, "won_auctions": 1, "created_at": 1}
    ).to_list(1000)
    
    # Calculate wins
    leaderboard = []
    for user in users:
        wins = len(user.get("won_auctions", []))
        if wins > 0:
            leaderboard.append({
                "name": user["name"],
                "wins": wins,
                "member_since": user.get("created_at", "")[:10]
            })
    
    # Sort by wins
    leaderboard.sort(key=lambda x: x["wins"], reverse=True)
    
    return leaderboard[:50]  # Top 50

# ==================== IMPROVED BID PACKAGES ====================

ENHANCED_BID_PACKAGES = [
    {"id": "starter", "name": "Starter", "bids": 50, "price": 15.00, "bonus": 0, "per_bid": 0.30, "popular": False},
    {"id": "popular", "name": "Beliebt", "bids": 100, "price": 25.00, "bonus": 10, "per_bid": 0.23, "popular": True},
    {"id": "value", "name": "Mehrwert", "bids": 200, "price": 45.00, "bonus": 30, "per_bid": 0.20, "popular": False},
    {"id": "pro", "name": "Profi", "bids": 500, "price": 99.00, "bonus": 100, "per_bid": 0.17, "popular": False, "best_value": True},
    {"id": "whale", "name": "VIP", "bids": 1000, "price": 179.00, "bonus": 250, "per_bid": 0.14, "popular": False},
]

@api_router.get("/bid-packages-enhanced")
async def get_enhanced_bid_packages():
    """Get enhanced bid packages with bonuses"""
    return ENHANCED_BID_PACKAGES

# ==================== WEBSOCKET ENDPOINTS ====================

# WebSocket endpoints (both with and without /api prefix for compatibility)
@app.websocket("/ws/auction/{auction_id}")
@app.websocket("/api/ws/auction/{auction_id}")
async def websocket_auction(websocket: WebSocket, auction_id: str):
    """WebSocket endpoint for real-time auction updates"""
    await ws_manager.connect(websocket, auction_id)
    
    try:
        # Send initial auction state
        auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
        if auction:
            product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
            await websocket.send_json({
                "type": "auction_state",
                "data": {
                    "id": auction["id"],
                    "current_price": auction.get("current_price", 0),
                    "end_time": auction.get("end_time"),
                    "status": auction.get("status"),
                    "total_bids": auction.get("total_bids", 0),
                    "last_bidder_name": auction.get("last_bidder_name"),
                    "product": {
                        "name": product.get("name") if product else "Unknown",
                        "image_url": product.get("image_url") if product else ""
                    },
                    "viewers": ws_manager.get_connection_count(auction_id)
                }
            })
        
        # Keep connection alive and listen for messages
        while True:
            try:
                # Wait for messages from client (ping/pong or commands)
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()})
                
            except asyncio.TimeoutError:
                # Send heartbeat
                try:
                    await websocket.send_json({"type": "heartbeat", "timestamp": datetime.now(timezone.utc).isoformat()})
                except:
                    break
                    
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from auction {auction_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket)

@app.websocket("/ws/auctions")
@app.websocket("/api/ws/auctions")
async def websocket_all_auctions(websocket: WebSocket):
    """WebSocket endpoint for all auction updates (auction list page)"""
    await ws_manager.connect(websocket, "all_auctions")
    
    try:
        # Send initial state of all active auctions
        auctions = await db.auctions.find(
            {"status": {"$in": ["active", "scheduled"]}},
            {"_id": 0, "bid_history": 0}
        ).to_list(100)
        
        await websocket.send_json({
            "type": "auctions_state",
            "data": auctions,
            "viewers": ws_manager.get_connection_count()
        })
        
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "heartbeat"})
                except:
                    break
                    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket)


async def broadcast_bid_update(auction_id: str, bid_data: Dict):
    """Broadcast a bid update to all connected clients"""
    message = {
        "type": "bid_update",
        "auction_id": auction_id,
        "data": bid_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Broadcast to specific auction viewers
    await ws_manager.broadcast_to_auction(auction_id, message)
    
    # Also broadcast to "all auctions" viewers
    await ws_manager.broadcast_to_auction("all_auctions", message)


async def broadcast_auction_ended(auction_id: str, winner_name: str, final_price: float):
    """Broadcast auction end to all connected clients"""
    message = {
        "type": "auction_ended",
        "auction_id": auction_id,
        "data": {
            "winner_name": winner_name,
            "final_price": final_price
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await ws_manager.broadcast_to_auction(auction_id, message)
    await ws_manager.broadcast_to_auction("all_auctions", message)

# ==================== BID HISTORY ENDPOINT ====================

@api_router.get("/auctions/{auction_id}/bid-history")
async def get_auction_bid_history(auction_id: str, limit: int = 50):
    """Get bid history for a specific auction"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "bid_history": 1})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    bid_history = auction.get("bid_history", [])
    # Sort by timestamp descending (newest first) and limit
    bid_history = sorted(bid_history, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]
    
    return bid_history

# ==================== WINNERS GALLERY ENDPOINT ====================

@api_router.get("/winners")
async def get_winners(limit: int = 20):
    """Get recent auction winners for the winners gallery"""
    # Find ended auctions with winners
    winners_pipeline = [
        {"$match": {"status": "ended", "winner_id": {"$ne": None}}},
        {"$sort": {"ended_at": -1}},
        {"$limit": limit}
    ]
    
    ended_auctions = await db.auctions.aggregate(winners_pipeline).to_list(limit)
    
    winners = []
    for auction in ended_auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            savings = 0
            if product.get("retail_price") and auction.get("current_price"):
                savings = round((product["retail_price"] - auction["current_price"]) / product["retail_price"] * 100)
            
            winners.append({
                "auction_id": auction.get("id"),
                "winner_name": auction.get("winner_name"),
                "product_name": product.get("name"),
                "product_image": product.get("image_url"),
                "product_category": product.get("category"),
                "final_price": auction.get("current_price"),
                "retail_price": product.get("retail_price"),
                "savings_percent": savings,
                "total_bids": auction.get("total_bids", 0),
                "ended_at": auction.get("ended_at") or auction.get("end_time")
            })
    
    return winners

# ==================== CATEGORIES ENDPOINT ====================

@api_router.get("/categories")
async def get_categories():
    """Get all product categories with auction counts"""
    # Get distinct categories from products
    products = await db.products.find({}, {"_id": 0, "category": 1}).to_list(1000)
    
    category_counts = {}
    for p in products:
        cat = p.get("category", "Sonstige")
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    # Get auction counts per category
    auctions = await db.auctions.find({"status": {"$in": ["active", "scheduled"]}}, {"_id": 0, "product_id": 1}).to_list(1000)
    
    category_auction_counts = {}
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0, "category": 1})
        if product:
            cat = product.get("category", "Sonstige")
            category_auction_counts[cat] = category_auction_counts.get(cat, 0) + 1
    
    categories = []
    for cat, product_count in category_counts.items():
        categories.append({
            "name": cat,
            "product_count": product_count,
            "active_auction_count": category_auction_counts.get(cat, 0)
        })
    
    # Sort by auction count descending
    categories.sort(key=lambda x: x["active_auction_count"], reverse=True)
    
    return categories

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "BidBlitz Auction API", "version": "2.2.0"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== AUTOMATIC BOT BIDDING (LAST SECOND) ====================

import asyncio as async_lib

# Global flag to control the bot task
bot_task_running = False

async def bot_last_second_bidder():
    """Background task that makes bots bid continuously until target price is reached"""
    global bot_task_running
    bot_task_running = True
    
    logger.info("Bot continuous bidder started")
    
    # Track last bot per auction to avoid same bot bidding twice in a row
    last_bot_per_auction = {}
    
    while bot_task_running:
        try:
            # Get all active auctions with bot target prices
            active_auctions = await db.auctions.find({
                "status": "active",
                "bot_target_price": {"$gt": 0}
            }, {"_id": 0}).to_list(100)
            
            for auction in active_auctions:
                try:
                    end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
                    now = datetime.now(timezone.utc)
                    seconds_left = (end_time - now).total_seconds()
                    
                    # Bid when timer is between 1-5 seconds
                    if 1 <= seconds_left <= 5:
                        current_price = auction.get("current_price", 0)
                        target_price = auction.get("bot_target_price", 0)
                        auction_id = auction.get("id")
                        
                        # Continue bidding until target price is reached
                        if current_price < target_price:
                            # Get all active bots
                            bots = await db.bots.find({"is_active": True}, {"_id": 0}).to_list(100)
                            if bots:
                                # Choose a different bot than the last one for this auction
                                last_bot_id = last_bot_per_auction.get(auction_id)
                                available_bots = [b for b in bots if b["id"] != last_bot_id]
                                
                                # If all bots have been filtered, use all bots
                                if not available_bots:
                                    available_bots = bots
                                
                                bot = random.choice(available_bots)
                                last_bot_per_auction[auction_id] = bot["id"]
                                
                                # Place the bid
                                new_price = round(current_price + auction.get("bid_increment", 0.01), 2)
                                
                                # Random timer extension between 10-20 seconds for realism
                                timer_extension = random.randint(10, 20)
                                new_end_time = datetime.now(timezone.utc) + timedelta(seconds=timer_extension)
                                
                                bid_entry = {
                                    "user_id": f"bot_{bot['id']}",
                                    "user_name": bot["name"],
                                    "price": new_price,
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                    "is_bot": True,
                                    "is_autobid": True
                                }
                                
                                await db.auctions.update_one(
                                    {"id": auction_id, "status": "active"},
                                    {
                                        "$set": {
                                            "current_price": new_price,
                                            "end_time": new_end_time.isoformat(),
                                            "last_bidder_id": f"bot_{bot['id']}",
                                            "last_bidder_name": bot["name"]
                                        },
                                        "$inc": {"total_bids": 1},
                                        "$push": {"bid_history": bid_entry}
                                    }
                                )
                                
                                # Update bot stats
                                await db.bots.update_one(
                                    {"id": bot["id"]},
                                    {"$inc": {"total_bids_placed": 1}}
                                )
                                
                                # Broadcast the bid via WebSocket
                                await broadcast_bid_update(auction_id, {
                                    "current_price": new_price,
                                    "last_bidder_name": bot["name"],
                                    "last_bidder_id": f"bot_{bot['id']}",
                                    "total_bids": auction.get("total_bids", 0) + 1,
                                    "end_time": new_end_time.isoformat(),
                                    "bidder_message": f"{bot['name']} hat geboten!"
                                })
                                
                                logger.info(f"Bot '{bot['name']}' bid €{new_price:.2f} on auction {auction_id[:8]}... (target: €{target_price:.2f})")
                                
                except Exception as e:
                    logger.error(f"Error in bot bidding for auction {auction.get('id')}: {e}")
            
            # Check every 500ms for precise timing
            await async_lib.sleep(0.5)
            
        except Exception as e:
            logger.error(f"Bot bidder error: {e}")
            await async_lib.sleep(1)
    
    logger.info("Bot last-second bidder stopped")

# ==================== EMAIL MARKETING ENDPOINTS ====================

@app.get("/api/admin/email/templates")
async def get_email_templates(current_user: dict = Depends(get_admin_user)):
    """Get available email templates"""
    templates = [
        {
            "id": "welcome",
            "name": "Willkommens-E-Mail",
            "subject": "Willkommen bei BidBlitz! 🎉",
            "preview": "Begrüßen Sie neue Benutzer..."
        },
        {
            "id": "new_auction",
            "name": "Neue Auktion",
            "subject": "🔥 Neue Auktion: {product_name}",
            "preview": "Informieren Sie über neue Auktionen..."
        },
        {
            "id": "special_offer",
            "name": "Sonderangebot",
            "subject": "💰 Exklusives Angebot nur für Sie!",
            "preview": "Bewerben Sie spezielle Gebotspaket..."
        },
        {
            "id": "reactivation",
            "name": "Reaktivierung",
            "subject": "Wir vermissen Sie! 😢",
            "preview": "Reaktivieren Sie inaktive Benutzer..."
        },
        {
            "id": "custom",
            "name": "Benutzerdefiniert",
            "subject": "",
            "preview": "Erstellen Sie eine eigene E-Mail..."
        }
    ]
    return templates

@app.get("/api/admin/email/user-stats")
async def get_email_user_stats(current_user: dict = Depends(get_admin_user)):
    """Get user statistics for email targeting"""
    total_users = await db.users.count_documents({"role": "customer"})
    
    # Active users (bid in last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    active_users = await db.users.count_documents({
        "role": "customer",
        "last_bid_time": {"$gte": seven_days_ago}
    })
    
    # Inactive users (no bid in 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    inactive_users = await db.users.count_documents({
        "role": "customer",
        "$or": [
            {"last_bid_time": {"$lt": thirty_days_ago}},
            {"last_bid_time": {"$exists": False}}
        ]
    })
    
    # Winners
    winners = await db.users.count_documents({
        "role": "customer",
        "auctions_won": {"$gt": 0}
    })
    
    # New users (registered in last 7 days)
    new_users = await db.users.count_documents({
        "role": "customer",
        "created_at": {"$gte": seven_days_ago.isoformat()}
    })
    
    return {
        "total": total_users,
        "active": active_users,
        "inactive": inactive_users,
        "winners": winners,
        "new_users": new_users
    }

@app.post("/api/admin/email/test")
async def send_test_email(data: EmailTestSend, current_user: dict = Depends(get_admin_user)):
    """Send a test email to a single address"""
    result = await send_email(data.to_email, data.subject, data.html_content)
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))
    return {"success": True, "message": f"Test-E-Mail an {data.to_email} gesendet", "result": result}

@app.post("/api/admin/email/campaign")
async def send_email_campaign(data: EmailCampaignCreate, current_user: dict = Depends(get_admin_user)):
    """Send email campaign to targeted user group"""
    
    # Build query based on target group
    query = {"role": "customer"}
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    if data.target_group == "active":
        query["last_bid_time"] = {"$gte": seven_days_ago}
    elif data.target_group == "inactive":
        query["$or"] = [
            {"last_bid_time": {"$lt": thirty_days_ago}},
            {"last_bid_time": {"$exists": False}}
        ]
    elif data.target_group == "winners":
        query["auctions_won"] = {"$gt": 0}
    elif data.target_group == "new_users":
        query["created_at"] = {"$gte": seven_days_ago.isoformat()}
    
    # Get users
    users = await db.users.find(query, {"email": 1, "name": 1}).to_list(1000)
    
    if not users:
        raise HTTPException(status_code=404, detail="Keine Benutzer in dieser Gruppe gefunden")
    
    # Send emails (in background to avoid timeout)
    sent_count = 0
    failed_count = 0
    
    for user in users:
        try:
            # Personalize content
            personalized_content = data.html_content.replace("{name}", user.get("name", "Kunde"))
            personalized_subject = data.subject.replace("{name}", user.get("name", "Kunde"))
            
            result = await send_email(user["email"], personalized_subject, personalized_content)
            if result.get("status") == "sent":
                sent_count += 1
            else:
                failed_count += 1
        except Exception as e:
            logger.error(f"Failed to send campaign email to {user.get('email')}: {e}")
            failed_count += 1
    
    # Log campaign
    campaign_log = {
        "id": str(uuid.uuid4()),
        "subject": data.subject,
        "target_group": data.target_group,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "total_recipients": len(users),
        "sent_by": current_user["email"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.email_campaigns.insert_one(campaign_log)
    
    return {
        "success": True,
        "message": f"Kampagne gesendet: {sent_count} erfolgreich, {failed_count} fehlgeschlagen",
        "sent": sent_count,
        "failed": failed_count,
        "total": len(users)
    }

@app.get("/api/admin/email/campaigns")
async def get_email_campaigns(current_user: dict = Depends(get_admin_user)):
    """Get list of past email campaigns"""
    campaigns = await db.email_campaigns.find({}).sort("created_at", -1).to_list(50)
    for c in campaigns:
        c.pop("_id", None)
    return campaigns

@app.on_event("startup")
async def startup_event():
    """Start background tasks on server startup"""
    async_lib.create_task(bot_last_second_bidder())
    logger.info("Background bot bidder task started")

@app.on_event("shutdown")
async def shutdown_db_client():
    global bot_task_running
    bot_task_running = False
    client.close()
