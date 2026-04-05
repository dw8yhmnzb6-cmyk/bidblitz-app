from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=100)
    invite_code: Optional[str] = None
    requested_role: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TopUpRequest(BaseModel):
    amount: float = Field(gt=0, le=50000)
    payment_method: str = "bank_transfer"


class PaymentRequest(BaseModel):
    amount: float = Field(gt=0)
    merchant_id: str
    description: Optional[str] = ""


class SendRequest(BaseModel):
    amount: float = Field(gt=0)
    recipient_email: EmailStr
    description: Optional[str] = ""


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    balance: float
    currency: str
    card_number: str
    card_expiry: str
    created_at: Optional[str] = None


class TransactionResponse(BaseModel):
    id: str
    user_id: str
    type: str
    amount: float
    description: str
    merchant_name: Optional[str] = ""
    status: str
    reference: str
    payment_method: str
    category: str
    created_at: str


class MerchantDashboard(BaseModel):
    merchant_id: str
    business_name: str
    total_earnings: float
    total_transactions: int
    today_earnings: float
    today_transactions: int
    recent_payments: list


class MerchantScanPayment(BaseModel):
    customer_barcode: str = Field(min_length=6, max_length=64)
    amount: float = Field(gt=0)
    description: Optional[str] = ""
    idempotency_key: Optional[str] = None
