"""Provider contract configuration for BidBlitz Fuel (DEV model only).

Models the commercial/technical facts that must be confirmed before a provider
can be enabled. It does not sign contracts, store secrets or execute payments.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum

from services.fuel_finance import FeeOwner, MerchantRole


class ProviderContractState(str, Enum):
    DRAFT = "draft"
    UNDER_REVIEW = "under_review"
    SIGNED = "signed"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"


class RevenueModel(str, Enum):
    NONE = "none"
    PERCENTAGE = "percentage"
    PER_LITER = "per_liter"
    PER_TRANSACTION = "per_transaction"
    MONTHLY = "monthly"
    HYBRID = "hybrid"


@dataclass(frozen=True)
class ProviderCommercialTerms:
    revenue_model: RevenueModel = RevenueModel.NONE
    percentage: Decimal = Decimal("0")
    per_liter: Decimal = Decimal("0")
    per_transaction: Decimal = Decimal("0")
    monthly_fee: Decimal = Decimal("0")
    payment_fee_owner: FeeOwner = FeeOwner.OPERATOR
    merchant_of_record: MerchantRole = MerchantRole.OPERATOR
    supplier_of_record: MerchantRole = MerchantRole.OPERATOR
    currency: str = "EUR"

    def __post_init__(self) -> None:
        for name in ("percentage", "per_liter", "per_transaction", "monthly_fee"):
            value = Decimal(str(getattr(self, name)))
            if not value.is_finite() or value < 0:
                raise ValueError(f"{name} must be finite and non-negative")
            object.__setattr__(self, name, value)
        if self.percentage > 100:
            raise ValueError("percentage cannot exceed 100")
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValueError("currency must be 3 letters")
        object.__setattr__(self, "currency", self.currency.upper())


@dataclass(frozen=True)
class ProviderContractConfig:
    provider: str
    state: ProviderContractState = ProviderContractState.DRAFT
    territories: frozenset[str] = field(default_factory=frozenset)
    station_discovery_rights: bool = False
    fueling_rights: bool = False
    white_label_rights: bool = False
    api_rights: bool = False
    payment_rights: bool = False
    split_settlement_rights: bool = False
    receipt_responsibility_confirmed: bool = False
    commercial_terms: ProviderCommercialTerms = field(default_factory=ProviderCommercialTerms)
    contract_reference: str = ""
    effective_from: str = ""
    effective_until: str = ""

    def __post_init__(self) -> None:
        if not self.provider.strip():
            raise ValueError("provider required")
        for country in self.territories:
            if len(country) != 2 or country != country.upper() or not country.isalpha():
                raise ValueError("territories must use uppercase ISO alpha-2")
        if self.state == ProviderContractState.SIGNED and not self.contract_reference.strip():
            raise ValueError("signed contract requires contract reference")

    @property
    def signed(self) -> bool:
        return self.state == ProviderContractState.SIGNED

    @property
    def discovery_ready(self) -> bool:
        return self.signed and self.api_rights and self.station_discovery_rights and bool(self.territories)

    @property
    def fueling_ready(self) -> bool:
        return (
            self.discovery_ready
            and self.fueling_rights
            and self.payment_rights
            and self.split_settlement_rights
            and self.receipt_responsibility_confirmed
        )

    def payload(self) -> dict:
        return {
            "provider": self.provider,
            "state": self.state.value,
            "territories": sorted(self.territories),
            "rights": {
                "api": self.api_rights,
                "station_discovery": self.station_discovery_rights,
                "fueling": self.fueling_rights,
                "white_label": self.white_label_rights,
                "payment": self.payment_rights,
                "split_settlement": self.split_settlement_rights,
                "receipt_responsibility_confirmed": self.receipt_responsibility_confirmed,
            },
            "commercial": {
                "revenue_model": self.commercial_terms.revenue_model.value,
                "percentage": str(self.commercial_terms.percentage),
                "per_liter": str(self.commercial_terms.per_liter),
                "per_transaction": str(self.commercial_terms.per_transaction),
                "monthly_fee": str(self.commercial_terms.monthly_fee),
                "payment_fee_owner": self.commercial_terms.payment_fee_owner.value,
                "merchant_of_record": self.commercial_terms.merchant_of_record.value,
                "supplier_of_record": self.commercial_terms.supplier_of_record.value,
                "currency": self.commercial_terms.currency,
            },
            "contract_reference": self.contract_reference,
            "effective_from": self.effective_from,
            "effective_until": self.effective_until,
            "discovery_ready": self.discovery_ready,
            "fueling_ready": self.fueling_ready,
        }


def unsigned_template(provider: str) -> ProviderContractConfig:
    return ProviderContractConfig(provider=provider)
