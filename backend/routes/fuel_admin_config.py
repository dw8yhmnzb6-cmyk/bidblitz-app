"""Admin-only BidBlitz Fuel configuration endpoints.

These routes modify/read only DEV configuration records in the existing BidBlitz
database. They never store provider secrets and never enable live provider or
payment execution by themselves.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from services.dkv_enterprise import DkvCustomerTenant, DkvDataset, DkvOnboardingState
from services.dkv_read_adapter import build_request_plan
from services.fuel_provider_contract_repository import (
    FuelProviderContractRepository,
    contract_from_payload,
)
from services.fuel_provider_onboarding import provider_by_name
from services.fuel_repository import FuelRepository

router = APIRouter(prefix="/api/fuel/admin-config", tags=["fuel-admin-config"])


class ContractSaveRequest(BaseModel):
    state: str = Field("draft", max_length=40)
    territories: list[str] = Field(default_factory=list)
    rights: dict = Field(default_factory=dict)
    commercial: dict = Field(default_factory=dict)
    contract_reference: str = Field("", max_length=200)
    effective_from: str = Field("", max_length=80)
    effective_until: str = Field("", max_length=80)


class DkvPlanRequest(BaseModel):
    customer_id: str = Field(..., min_length=1, max_length=120)
    dataset: str = Field(..., min_length=1, max_length=80)
    enabled_datasets: list[str] = Field(default_factory=list)
    production_access_approved: bool = False
    technical_user_configured: bool = False
    query: dict = Field(default_factory=dict)


async def _admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/contracts")
async def list_provider_contracts(request: Request):
    await _admin(request)
    repo = FuelProviderContractRepository(db)
    rows = await repo.list(limit=200)
    return {"contracts": rows}


@router.get("/contracts/{provider_name}")
async def get_provider_contract(provider_name: str, request: Request):
    await _admin(request)
    if not provider_by_name(provider_name):
        raise HTTPException(status_code=404, detail="Provider not found")
    repo = FuelProviderContractRepository(db)
    row = await repo.get(provider_name)
    return {"provider": provider_name, "contract": row}


@router.put("/contracts/{provider_name}")
async def save_provider_contract(provider_name: str, body: ContractSaveRequest, request: Request):
    user = await _admin(request)
    if not provider_by_name(provider_name):
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        config = contract_from_payload(provider_name, body.model_dump())
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    repo = FuelProviderContractRepository(db)
    actor = user.get("email") or str(user.get("_id") or "admin")
    saved = await repo.save(config, actor=actor)
    return {
        "ok": True,
        "contract": saved,
        "warning": "Saving contract configuration does not enable provider credentials or live payment execution.",
    }


@router.get("/sessions")
async def list_persisted_fuel_sessions(request: Request, station_id: str = "", limit: int = 100):
    await _admin(request)
    if not 1 <= limit <= 500:
        raise HTTPException(status_code=400, detail="limit out of range")

    repo = FuelRepository(db)
    if station_id:
        rows = await repo.list_by_station(station_id, limit=limit)
        return {"sessions": [row.to_document() for row in rows]}

    cursor = db.fuel_sessions.find({}, {"_id": 0}).sort("updated_at", -1).limit(limit)
    docs = await cursor.to_list(limit)
    return {"sessions": docs}


@router.post("/dkv/request-plan")
async def preview_dkv_request_plan(body: DkvPlanRequest, request: Request):
    await _admin(request)
    try:
        requested = DkvDataset(body.dataset)
        enabled = frozenset(DkvDataset(item) for item in body.enabled_datasets)
        tenant = DkvCustomerTenant(
            customer_id=body.customer_id,
            state=DkvOnboardingState.ACTIVE,
            enabled_datasets=enabled,
            production_access_approved=body.production_access_approved,
            technical_user_configured=body.technical_user_configured,
        )
        plan = build_request_plan(tenant, requested, query=body.query)
    except (ValueError, TypeError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "ok": True,
        "execution_enabled": False,
        "plan": {
            "customer_id": plan.customer_id,
            "dataset": plan.dataset.value,
            "query": plan.query,
            "method": plan.method,
            "content_type": plan.content_type,
        },
        "message": "Preview only. No outbound DKV request was executed.",
    }
