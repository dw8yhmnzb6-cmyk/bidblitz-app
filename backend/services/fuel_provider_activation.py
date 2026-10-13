"""Fuel provider activation readiness (DEV foundation).

Combines commercial contract state, static onboarding facts, and an explicit
non-secret credential-readiness flag. It never reads or exposes API keys.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from services.fuel_provider_contracts import ProviderContractConfig
from services.fuel_provider_onboarding import ProviderOnboarding


@dataclass(frozen=True)
class ProviderActivationStatus:
    provider: str
    contract_signed: bool
    contract_discovery_rights: bool
    contract_fueling_rights: bool
    onboarding_api_confirmed: bool
    onboarding_station_discovery_confirmed: bool
    onboarding_fueling_confirmed: bool
    onboarding_payment_confirmed: bool
    credentials_ready: bool
    discovery_ready: bool
    fueling_ready: bool
    missing_discovery: tuple[str, ...]
    missing_fueling: tuple[str, ...]

    def payload(self) -> dict:
        return {
            "provider": self.provider,
            "contract_signed": self.contract_signed,
            "contract_discovery_rights": self.contract_discovery_rights,
            "contract_fueling_rights": self.contract_fueling_rights,
            "onboarding_api_confirmed": self.onboarding_api_confirmed,
            "onboarding_station_discovery_confirmed": self.onboarding_station_discovery_confirmed,
            "onboarding_fueling_confirmed": self.onboarding_fueling_confirmed,
            "onboarding_payment_confirmed": self.onboarding_payment_confirmed,
            "credentials_ready": self.credentials_ready,
            "discovery_ready": self.discovery_ready,
            "fueling_ready": self.fueling_ready,
            "missing_discovery": list(self.missing_discovery),
            "missing_fueling": list(self.missing_fueling),
        }


def credential_readiness_flag(provider: str) -> bool:
    key = "FUEL_" + provider.upper().replace("-", "_") + "_CREDENTIALS_CONFIGURED"
    return (os.environ.get(key) or "").strip().lower() in {"1", "true", "yes", "on"}


def evaluate_provider_activation(
    onboarding: ProviderOnboarding,
    contract: ProviderContractConfig,
    *,
    credentials_ready: bool | None = None,
) -> ProviderActivationStatus:
    if onboarding.provider != contract.provider:
        raise ValueError("provider mismatch")
    creds = credential_readiness_flag(onboarding.provider) if credentials_ready is None else bool(credentials_ready)

    discovery_checks = {
        "signed_contract": contract.signed,
        "contract_api_rights": contract.api_rights,
        "contract_station_discovery_rights": contract.station_discovery_rights,
        "territories": bool(contract.territories),
        "provider_api_confirmed": onboarding.api_confirmed,
        "provider_station_discovery_confirmed": onboarding.station_discovery_confirmed,
        "credentials_configured": creds,
    }
    fueling_checks = {
        **discovery_checks,
        "contract_fueling_rights": contract.fueling_rights,
        "contract_payment_rights": contract.payment_rights,
        "contract_split_settlement_rights": contract.split_settlement_rights,
        "receipt_responsibility_confirmed": contract.receipt_responsibility_confirmed,
        "provider_fueling_confirmed": onboarding.fueling_confirmed,
        "provider_payment_confirmed": onboarding.payment_confirmed,
        "provider_split_settlement_confirmed": onboarding.split_settlement_confirmed,
    }

    missing_discovery = tuple(name for name, ok in discovery_checks.items() if not ok)
    missing_fueling = tuple(name for name, ok in fueling_checks.items() if not ok)

    return ProviderActivationStatus(
        provider=onboarding.provider,
        contract_signed=contract.signed,
        contract_discovery_rights=contract.discovery_ready,
        contract_fueling_rights=contract.fueling_ready,
        onboarding_api_confirmed=onboarding.api_confirmed,
        onboarding_station_discovery_confirmed=onboarding.station_discovery_confirmed,
        onboarding_fueling_confirmed=onboarding.fueling_confirmed,
        onboarding_payment_confirmed=onboarding.payment_confirmed,
        credentials_ready=creds,
        discovery_ready=not missing_discovery,
        fueling_ready=not missing_fueling,
        missing_discovery=missing_discovery,
        missing_fueling=missing_fueling,
    )
