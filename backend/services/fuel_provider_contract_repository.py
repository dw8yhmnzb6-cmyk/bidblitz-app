"""Repository for BidBlitz Fuel provider contracts in the existing Mongo DB.

Stores commercial/technical configuration only. Secrets and API credentials are
explicitly forbidden and belong in the existing secret/env infrastructure.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from services.fuel_finance import FeeOwner, MerchantRole
from services.fuel_provider_contracts import (
    ProviderCommercialTerms,
    ProviderContractConfig,
    ProviderContractState,
    RevenueModel,
)


SENSITIVE_KEYS = {
    "password", "secret", "token", "api_key", "apikey", "authorization",
    "client_secret", "private_key", "access_token", "refresh_token",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _reject_sensitive(obj) -> None:
    if isinstance(obj, dict):
        for key, value in obj.items():
            if str(key).lower() in SENSITIVE_KEYS:
                raise ValueError("provider contract documents must not contain secrets")
            _reject_sensitive(value)
    elif isinstance(obj, (list, tuple)):
        for value in obj:
            _reject_sensitive(value)


def contract_from_payload(provider: str, payload: dict) -> ProviderContractConfig:
    _reject_sensitive(payload)
    commercial = payload.get("commercial") or {}
    rights = payload.get("rights") or {}
    terms = ProviderCommercialTerms(
        revenue_model=RevenueModel(commercial.get("revenue_model") or "none"),
        percentage=Decimal(str(commercial.get("percentage") or "0")),
        per_liter=Decimal(str(commercial.get("per_liter") or "0")),
        per_transaction=Decimal(str(commercial.get("per_transaction") or "0")),
        monthly_fee=Decimal(str(commercial.get("monthly_fee") or "0")),
        payment_fee_owner=FeeOwner(commercial.get("payment_fee_owner") or "operator"),
        merchant_of_record=MerchantRole(commercial.get("merchant_of_record") or "operator"),
        supplier_of_record=MerchantRole(commercial.get("supplier_of_record") or "operator"),
        currency=commercial.get("currency") or "EUR",
    )
    return ProviderContractConfig(
        provider=provider,
        state=ProviderContractState(payload.get("state") or "draft"),
        territories=frozenset(payload.get("territories") or ()),
        station_discovery_rights=bool(rights.get("station_discovery")),
        fueling_rights=bool(rights.get("fueling")),
        white_label_rights=bool(rights.get("white_label")),
        api_rights=bool(rights.get("api")),
        payment_rights=bool(rights.get("payment")),
        split_settlement_rights=bool(rights.get("split_settlement")),
        receipt_responsibility_confirmed=bool(rights.get("receipt_responsibility_confirmed")),
        commercial_terms=terms,
        contract_reference=(payload.get("contract_reference") or "").strip(),
        effective_from=(payload.get("effective_from") or "").strip(),
        effective_until=(payload.get("effective_until") or "").strip(),
    )


class FuelProviderContractRepository:
    def __init__(self, database) -> None:
        self.collection = database.fuel_provider_contracts

    async def get(self, provider: str) -> dict | None:
        doc = await self.collection.find_one({"provider": provider}, {"_id": 0})
        return doc

    async def list(self, *, limit: int = 100) -> list[dict]:
        if not 1 <= limit <= 500:
            raise ValueError("limit out of range")
        return await self.collection.find({}, {"_id": 0}).sort("provider", 1).limit(limit).to_list(limit)

    async def save(self, config: ProviderContractConfig, *, actor: str) -> dict:
        if not actor.strip():
            raise ValueError("actor required")
        payload = config.payload()
        _reject_sensitive(payload)
        now = _now()
        doc = {
            **payload,
            "updated_at": now,
            "updated_by": actor,
        }
        existing = await self.collection.find_one({"provider": config.provider}, {"_id": 0, "created_at": 1})
        if existing and existing.get("created_at"):
            doc["created_at"] = existing["created_at"]
        else:
            doc["created_at"] = now
        await self.collection.update_one(
            {"provider": config.provider},
            {"$set": doc},
            upsert=True,
        )
        return doc
