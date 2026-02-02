"""Pydantic models for all API endpoints"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any

# ==================== USER MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    source: Optional[str] = None
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    two_factor_code: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    bids_balance: Optional[int] = None

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# ==================== PASSWORD RESET MODELS ====================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

# ==================== PRODUCT MODELS ====================

class ProductTranslations(BaseModel):
    """Translations for product name and description"""
    de: Optional[str] = None
    en: Optional[str] = None
    tr: Optional[str] = None
    fr: Optional[str] = None
    sq: Optional[str] = None
    ar: Optional[str] = None

class ProductCreate(BaseModel):
    name: str
    description: str
    image_url: str
    retail_price: float
    category: str
    name_translations: Optional[Dict[str, str]] = None
    description_translations: Optional[Dict[str, str]] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    retail_price: Optional[float] = None
    category: Optional[str] = None
    name_translations: Optional[Dict[str, str]] = None
    description_translations: Optional[Dict[str, str]] = None

# ==================== AUCTION MODELS ====================

class AuctionCreate(BaseModel):
    product_id: str
    starting_price: float
    bid_increment: float
    duration_seconds: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    bot_target_price: Optional[float] = None
    buy_now_price: Optional[float] = None
    is_night_auction: Optional[bool] = False
    is_vip_only: Optional[bool] = False
    is_beginner_auction: Optional[bool] = False
    is_gift_auction: Optional[bool] = False
    auction_type: Optional[str] = "normal"  # normal, night, beginner, gift, mystery

class AuctionUpdate(BaseModel):
    duration_seconds: Optional[int] = None
    status: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

class BidRequest(BaseModel):
    auction_id: str

# ==================== AUTOBIDDER MODELS ====================

class AutobidderCreate(BaseModel):
    auction_id: str
    max_bids: int = 10
    max_price: Optional[float] = None
    bid_in_last_seconds: int = 5

# ==================== BOT MODELS ====================

class BotCreate(BaseModel):
    name: str

class BotBidRequest(BaseModel):
    auction_id: str
    bot_id: str
    target_price: Optional[float] = None
    num_bids: Optional[int] = None
    delay_seconds: Optional[int] = 2

class MultiBotBidRequest(BaseModel):
    auction_id: str
    target_price: float
    min_delay: Optional[float] = 1.0
    max_delay: Optional[float] = 5.0

# ==================== VOUCHER MODELS ====================

class VoucherCreate(BaseModel):
    code: str
    bids: int
    max_uses: int = 1
    expires_at: Optional[str] = None

class VoucherRedeem(BaseModel):
    code: str

# ==================== PAYMENT MODELS ====================

class CheckoutRequest(BaseModel):
    package_id: str
    origin_url: str

# ==================== AFFILIATE MODELS ====================

class AffiliateRegister(BaseModel):
    name: str
    email: EmailStr
    payment_method: str = "bank_transfer"
    payment_details: str

# ==================== BUY IT NOW MODELS ====================

class BuyNowRequest(BaseModel):
    auction_id: str

# ==================== WISHLIST MODELS ====================

class WishlistRequest(BaseModel):
    product_id: Optional[str] = None
    category: Optional[str] = None

# ==================== 2FA MODELS ====================

class TwoFactorSetup(BaseModel):
    pass

class TwoFactorEnable(BaseModel):
    code: str

class TwoFactorDisable(BaseModel):
    code: str
    password: str
