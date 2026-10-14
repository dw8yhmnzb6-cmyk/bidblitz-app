"""Repository for BidBlitz Fuel provider contracts in the existing Mongo DB.

Stores commercial/technical configuration only. Secrets and API credentials are
explicitly forbidden and belong in the existing secret/env infrastructure.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from services.fuel_finance import FeeOwner, MerchantRole
from services.fuel_provider_contracts import (
    ProviderCommercialTerms,
    ProviderContractConfig,
    ProviderContractState,
    RevenueModel,
)


SENSITIVE_KEYS = {
    "password", "secret", "token", "api_key", "apikey", "authorization",
    "client_secret", "clientsecret", "private_key", "access_token", "refresh_token",
    "bearer_token", "secret_key", "auth_header", "authorization_header",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _right(value, name: str) -> bool:
    """Rights must be real booleans, never truthy strings like 'false'."""
    if type(value) is not bool:
        raise ValueError(f"{name} must be a boolean")
    return value


def _rate(value, name: str) -> Decimal:
    try:
        number = Decimal(str(value if value is not None and value != "" else "0"))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"{name} must be a valid amount") from exc
    if not number.is_finite():
        raise ValueError(f"{name} must be finite")
    return number


def _reject_sensitive(obj) -> None:
    if isinstance(obj, dict):
        for key, value in obj.items():
            normalized_key = str(key).strip().lower().replace("-", "_").replace(" ", "_")
            if normalized_key in SENSITIVE_KEYS:
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
        percentage=_rate(commercial.get("percentage"), "percentage"),
        per_liter=_rate(commercial.get("per_liter"), "per_liter"),
        per_transaction=_rate(commercial.get("per_transaction"), "per_transaction"),
        monthly_fee=_rate(commercial.get("monthly_fee"), "monthly_fee"),
        payment_fee_owner=FeeOwner(commercial.get("payment_fee_owner") or "operator"),
        merchant_of_record=MerchantRole(commercial.get("merchant_of_record") or "operator"),
        supplier_of_record=MerchantRole(commercial.get("supplier_of_record") or "operator"),
        currency=commercial.get("currency") or "EUR",
    )
    return ProviderContractConfig(
        provider=provider,
        state=ProviderContractState(payload.get("state") or "draft"),
        territories=frozenset(payload.get("territories") or ()),
        station_discovery_rights=_right(rights.get("station_discovery", False), "station_discovery"),
        fueling_rights=_right(rights.get("fueling", False), "fueling"),
        white_label_rights=_right(rights.get("white_label", False), "white_label"),
        api_rights=_right(rights.get("api", False), "api"),
        payment_rights=_right(rights.get("payment", False), "payment"),
        split_settlement_rights=_right(rights.get("split_settlement", False), "split_settlement"),
        receipt_responsibility_confirmed=_right(rights.get("receipt_responsibility_confirmed", False), "receipt_responsibility_confirmed"),
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
