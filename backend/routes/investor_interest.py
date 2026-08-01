from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from core.database import db

router = APIRouter(prefix="/api/investor-interest", tags=["investor-interest"])


class InvestorInterestLeadRequest(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=80)
    last_name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(..., min_length=5, max_length=40)
    company: str = Field(default="", max_length=120)
    message: str = Field(default="", max_length=1000)
    intent: str = Field(default="interest", pattern="^(interest|documents)$")
    locale: str = Field(default="de", max_length=16)
    source_page: str = Field(default="/investieren", max_length=120)
    consent: bool = Field(default=False)


class InvestorInterestLeadPublic(BaseModel):
    lead_id: str
    intent: str
    status: str
    created_at: str


class InvestorInterestLeadResponse(BaseModel):
    success: bool
    message: str
    lead: InvestorInterestLeadPublic


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@router.post("/lead", response_model=InvestorInterestLeadResponse)
async def create_investor_interest_lead(payload: InvestorInterestLeadRequest, request: Request):
    if not payload.consent:
        raise HTTPException(status_code=400, detail="Bitte bestätige die Datenschutzhinweise.")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    client_ip = _get_client_ip(request)

    hourly_window_start = (now - timedelta(hours=1)).isoformat()
    ip_count = await db.investor_interest_leads.count_documents(
        {"source_ip": client_ip, "created_at": {"$gte": hourly_window_start}}
    )
    if ip_count >= 5:
        raise HTTPException(status_code=429, detail="Zu viele Anfragen. Bitte versuche es später erneut.")

    email = payload.email.strip().lower()
    duplicate_window_start = (now - timedelta(minutes=10)).isoformat()
    existing = await db.investor_interest_leads.find_one(
        {
            "email": email,
            "intent": payload.intent,
            "created_at": {"$gte": duplicate_window_start},
        },
        {"_id": 0, "lead_id": 1, "intent": 1, "status": 1, "created_at": 1},
    )
    if existing:
        return {
            "success": True,
            "message": "Deine Anfrage ist bereits eingegangen.",
            "lead": existing,
        }

    lead_id = f"INV-{uuid4().hex[:12].upper()}"
    lead_doc = payload.model_dump()
    lead_doc.update(
        {
            "lead_id": lead_id,
            "email": email,
            "status": "new",
            "created_at": now_iso,
            "updated_at": now_iso,
            "source_ip": client_ip,
            "user_agent": request.headers.get("user-agent", ""),
        }
    )
    await db.investor_interest_leads.insert_one(lead_doc)

    return {
        "success": True,
        "message": "Vielen Dank für dein Interesse.",
        "lead": {
            "lead_id": lead_id,
            "intent": payload.intent,
            "status": "new",
            "created_at": now_iso,
        },
    }