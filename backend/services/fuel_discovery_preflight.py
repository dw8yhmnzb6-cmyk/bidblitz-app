"""Read-only Fuel provider discovery preflight.

No network calls, station availability claims, pump operations or PSP execution.
Contract/credential flags are not proof of a provider's real authorization.
"""
from __future__ import annotations

import re
from datetime import date

from services.fuel_provider_activation import evaluate_provider_activation
from services.fuel_provider_contracts import ProviderContractConfig
from services.fuel_provider_onboarding import ProviderOnboarding


def _contract_day(value: str) -> date:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("invalid_contract_date")
    return date.fromisoformat(value)


def discovery_preflight(
    onboarding: ProviderOnboarding,
    contract: ProviderContractConfig,
    *,
    country: str,
    credentials_ready: bool | None = None,
    today: date | None = None,
) -> dict:
    """Evaluate an intended country without activating real partner discovery."""
    if not isinstance(country, str) or not re.fullmatch(r"[A-Z]{2}", country):
        raise ValueError("country must be an uppercase two-letter code")

    current_day = today if today is not None else date.today()
    if not isinstance(current_day, date):
        raise ValueError("invalid date")
    activation = evaluate_provider_activation(
        onboarding, contract, credentials_ready=credentials_ready
    )
    missing = list(activation.missing_discovery)

    if country not in contract.territories:
        missing.append("country_not_in_signed_territories")

    start_day = None
    end_day = None
    if not contract.effective_from:
        missing.append("contract_effective_from_missing")
    else:
        try:
            start_day = _contract_day(contract.effective_from)
        except ValueError:
            missing.append("invalid_contract_effective_from")
        else:
            if current_day < start_day:
                missing.append("contract_not_yet_effective")

    if contract.effective_until:
        try:
            end_day = _contract_day(contract.effective_until)
        except ValueError:
            missing.append("invalid_contract_effective_until")
        else:
            if current_day > end_day:
                missing.append("contract_expired")

    if start_day is not None and end_day is not None and end_day < start_day:
        missing.append("contract_date_window_invalid")

    conditions_met = len(missing) == 0
    return {
        "mode": "dev_read_only",
        "provider": onboarding.provider,
        "country": country,
        "checked_on": current_day.isoformat(),
        "contract_reference_recorded": bool(contract.contract_reference),
        "contract_effective_from": contract.effective_from,
        "contract_effective_until": contract.effective_until,
        "discovery_conditions_met": conditions_met,
        "missing": missing,
        "external_request_executed": False,
        "network_discovery_enabled": False,
        "payments_enabled": False,
        "pump_release_enabled": False,
        "message": (
            "Configuration review only; signed evidence, station allowlists, provider "
            "access and a separately approved adapter must be verified before live discovery."
        ),
    }
