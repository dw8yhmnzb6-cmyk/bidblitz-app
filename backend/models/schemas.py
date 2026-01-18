"""Pydantic models for BidBlitz API"""
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

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    bids_balance: int
    is_admin: bool
    created_at: str
    two_factor_enabled: bool = False

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

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    retail_price: Optional[float] = None
    category: Optional[str] = None

# ==================== AUCTION MODELS ====================

class AuctionCreate(BaseModel):
    product_id: str
    starting_price: float
    bid_increment: float
    duration_seconds: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    bot_target_price: Optional[float] = None
    buy_now_price: Optional[float] = None  # NEW: Buy It Now price

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
    buy_now_price: Optional[float] = None  # NEW

class AuctionUpdate(BaseModel):
    duration_seconds: Optional[int] = None
    status: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

class BidRequest(BaseModel):
    auction_id: str

# ==================== PAYMENT MODELS ====================

class BidPackage(BaseModel):
    id: str
    name: str
    bids: int
    price: float
    popular: bool = False
    bonus_bids: int = 0  # NEW: Bonus bids

class CheckoutRequest(BaseModel):
    package_id: str
    origin_url: str

# ==================== VOUCHER MODELS ====================

class VoucherCreate(BaseModel):
    code: str
    bids: int
    max_uses: int = 1
    expires_at: Optional[str] = None

class VoucherRedeem(BaseModel):
    code: str

# ==================== AUTOBIDDER MODELS ====================

class AutobidderCreate(BaseModel):
    auction_id: str
    max_bids: int = 10  # Maximum number of bids to place
    max_price: Optional[float] = None  # Maximum price willing to pay
    bid_in_last_seconds: int = 5  # Bid when timer reaches this many seconds

class AutobidderResponse(BaseModel):
    id: str
    auction_id: str
    user_id: str
    max_bids: int
    bids_used: int
    max_price: Optional[float]
    bid_in_last_seconds: int
    is_active: bool
    created_at: str

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

# ==================== AFFILIATE MODELS ====================

class AffiliateRegister(BaseModel):
    name: str
    email: EmailStr
    payment_method: str = "bank_transfer"
    payment_details: str

class AffiliateStats(BaseModel):
    total_referrals: int
    converted_leads: int
    pending_commission: float
    paid_commission: float
    current_tier: str
    commission_rate: float

# ==================== NEW FEATURE MODELS ====================

class BuyNowRequest(BaseModel):
    auction_id: str

class WishlistRequest(BaseModel):
    product_id: Optional[str] = None
    category: Optional[str] = None

class VIPSubscription(BaseModel):
    plan: str  # monthly, yearly

class ChatMessage(BaseModel):
    message: str
    auction_id: Optional[str] = None

# ==================== ACHIEVEMENT TYPES ====================

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
    FIRST_BID = "first_bid"
    BIDS_100 = "bids_100"
    BIDS_1000 = "bids_1000"
