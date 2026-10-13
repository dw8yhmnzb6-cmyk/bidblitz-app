"""BidBlitz Fuel provider onboarding matrix (DEV only).

Commercial/technical status registry. It records what has been confirmed and
what is still required before any provider can be activated.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class OnboardingStage(str, Enum):
    RESEARCH = "research"
    CONTACTED = "contacted"
    RESPONSE_RECEIVED = "response_received"
    COMMERCIAL_REVIEW = "commercial_review"
    TECHNICAL_ONBOARDING = "technical_onboarding"
    SANDBOX_READY = "sandbox_ready"
    PRODUCTION_REVIEW = "production_review"
    LIVE = "live"


@dataclass(frozen=True)
class ProviderOnboarding:
    provider: str
    stage: OnboardingStage
    api_confirmed: bool = False
    station_discovery_confirmed: bool = False
    fueling_confirmed: bool = False
    payment_confirmed: bool = False
    revenue_share_confirmed: bool = False
    split_settlement_confirmed: bool = False
    sandbox_confirmed: bool = False
    contract_signed: bool = False
    credentials_configured: bool = False
    notes: str = ""

    @property
    def can_enable_discovery(self) -> bool:
        return (
            self.contract_signed
            and self.credentials_configured
            and self.api_confirmed
            and self.station_discovery_confirmed
        )

    @property
    def can_enable_fueling(self) -> bool:
        return (
            self.can_enable_discovery
            and self.fueling_confirmed
            and self.payment_confirmed
            and self.split_settlement_confirmed
        )

    def payload(self) -> dict:
        return {
            "provider": self.provider,
            "stage": self.stage.value,
            "api_confirmed": self.api_confirmed,
            "station_discovery_confirmed": self.station_discovery_confirmed,
            "fueling_confirmed": self.fueling_confirmed,
            "payment_confirmed": self.payment_confirmed,
            "revenue_share_confirmed": self.revenue_share_confirmed,
            "split_settlement_confirmed": self.split_settlement_confirmed,
            "sandbox_confirmed": self.sandbox_confirmed,
            "contract_signed": self.contract_signed,
            "credentials_configured": self.credentials_configured,
            "can_enable_discovery": self.can_enable_discovery,
            "can_enable_fueling": self.can_enable_fueling,
            "notes": self.notes,
        }


MATRIX = (
    ProviderOnboarding(
        provider="dkv",
        stage=OnboardingStage.RESPONSE_RECEIVED,
        api_confirmed=True,
        sandbox_confirmed=False,
        notes="Enterprise data API confirmed; fueling/pay-at-pump, revenue share and split settlement still unconfirmed.",
    ),
    ProviderOnboarding(provider="pace", stage=OnboardingStage.CONTACTED, notes="Awaiting commercial/technical partner confirmation."),
    ProviderOnboarding(provider="shell", stage=OnboardingStage.CONTACTED, notes="Awaiting partner-specific SmartPay terms."),
    ProviderOnboarding(provider="uta", stage=OnboardingStage.CONTACTED, notes="Awaiting API/white-label/commercial confirmation."),
    ProviderOnboarding(provider="radius", stage=OnboardingStage.CONTACTED, notes="Awaiting partner-specific commercial and integration terms."),
    ProviderOnboarding(provider="circle_k", stage=OnboardingStage.RESEARCH, notes="Developer APIs researched; partner access not yet confirmed."),
    ProviderOnboarding(provider="eurowag", stage=OnboardingStage.RESEARCH, notes="Partnership/integration under evaluation."),
    ProviderOnboarding(provider="logos", stage=OnboardingStage.RESEARCH, api_confirmed=True, notes="Public API identified; commercial access still needs confirmation."),
    ProviderOnboarding(provider="moveyou", stage=OnboardingStage.RESEARCH, notes="Platform fit under evaluation."),
    ProviderOnboarding(provider="huth", stage=OnboardingStage.CONTACTED, notes="Direct POS/forecourt integration request prepared/sent."),
    ProviderOnboarding(provider="hectronic", stage=OnboardingStage.CONTACTED, notes="HecPoll/WebAPI partnership request prepared/sent."),
    ProviderOnboarding(provider="dfs_tokheim", stage=OnboardingStage.CONTACTED, notes="OASE/Prizma mobile-payment integration request prepared/sent."),
)


def provider_matrix() -> tuple[ProviderOnboarding, ...]:
    return MATRIX


def provider_by_name(name: str) -> ProviderOnboarding | None:
    key = (name or "").strip().lower()
    return next((item for item in MATRIX if item.provider == key), None)
