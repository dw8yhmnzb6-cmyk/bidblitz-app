"""Admin-only DEV preview for Fuel commercial proposals; never executes money movement."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.security import get_current_user
from services.fuel_business_model import preview_fuel_commercial_offer

router = APIRouter(prefix="/api/fuel/admin-config", tags=["fuel-admin-config"])


class FuelCommercialPreviewRequest(BaseModel):
    monthly_turnover: str = Field(default="100000", max_length=30)
    price_per_liter: str = Field(default="2.20", max_length=30)
    percent_rate: str = Field(default="0.20", max_length=30)
    cent_per_liter: str = Field(default="0.50", max_length=30)
    average_ticket: str = Field(default="50", max_length=30)
    psp_percent: str = Field(default="0", max_length=30)
    psp_fixed: str = Field(default="0", max_length=30)
    fee_basis: str = "gross"
    vat_percent: str = Field(default="19", max_length=30)
    payment_fee_owner: str = "operator"


@router.post("/commercial-preview")
async def commercial_preview(body: FuelCommercialPreviewRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        quote = preview_fuel_commercial_offer(**body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"ok": True, **quote}
