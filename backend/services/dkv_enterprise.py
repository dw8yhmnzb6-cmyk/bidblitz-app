"""DKV Enterprise API integration contract model (DEV only).

This module models only the data products confirmed by DKV API Management.
It intentionally does NOT model pay-at-pump, station discovery, payment,
merchant settlement or revenue share because those capabilities were not
confirmed in the Enterprise API response.

DKV confirmed:
- REST/JSON Enterprise API
- customer-specific onboarding and permissions
- multi-customer software platforms are possible
- no separate public sandbox; access is production after onboarding
- confirmed data products listed below

No outbound HTTP requests or credentials are implemented here.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class DkvDataset(str, Enum):
    INVOICE_DATA = "invoice_data"
    UNSETTLED_DATA = "unsettled_data"
    CONSUMPTION_DATA = "consumption_data"
    ONLINE_AUTHORIZATION_DATA = "online_authorization_data"
    SERVICE_CARD_MASTER_DATA = "service_card_master_data"
    TOLL_PRODUCT_MASTER_DATA = "toll_product_master_data"


CONFIRMED_DATASETS = frozenset(DkvDataset)


class DkvOnboardingState(str, Enum):
    NOT_STARTED = "not_started"
    REQUESTED = "requested"
    CUSTOMER_ONBOARDED = "customer_onboarded"
    TECHNICAL_USER_CREATED = "technical_user_created"
    ACTIVE = "active"
    SUSPENDED = "suspended"


@dataclass(frozen=True)
class DkvCustomerTenant:
    """One DKV customer context inside a multi-customer BidBlitz platform."""

    customer_id: str
    state: DkvOnboardingState = DkvOnboardingState.NOT_STARTED
    enabled_datasets: frozenset[DkvDataset] = field(default_factory=frozenset)
    production_access_approved: bool = False
    technical_user_configured: bool = False

    def __post_init__(self) -> None:
        if not self.customer_id.strip():
            raise ValueError("customer_id required")
        if any(item not in CONFIRMED_DATASETS for item in self.enabled_datasets):
            raise ValueError("unsupported DKV dataset")
        if self.state == DkvOnboardingState.ACTIVE:
            if not self.production_access_approved:
                raise ValueError("active DKV tenant requires production approval")
            if not self.technical_user_configured:
                raise ValueError("active DKV tenant requires technical user")

    @property
    def can_call_enterprise_api(self) -> bool:
        return (
            self.state == DkvOnboardingState.ACTIVE
            and self.production_access_approved
            and self.technical_user_configured
            and bool(self.enabled_datasets)
        )

    def permits(self, dataset: DkvDataset) -> bool:
        return self.can_call_enterprise_api and dataset in self.enabled_datasets


@dataclass(frozen=True)
class DkvEnterpriseProductProfile:
    monthly_price_eur: str = "69.90"
    rest_json: bool = True
    public_sandbox_available: bool = False
    direct_production_after_onboarding: bool = True
    supports_multi_customer_platform: bool = True
    customer_specific_authorization: bool = True


PROFILE = DkvEnterpriseProductProfile()


class DkvEnterpriseAccessBlocked(RuntimeError):
    pass


class DkvEnterpriseClientStub:
    """Fail-closed placeholder until official credentials/docs are onboarded.

    This deliberately performs zero network I/O. It validates tenant/dataset
    entitlement and then blocks, preventing accidental production calls.
    """

    def __init__(self, tenant: DkvCustomerTenant) -> None:
        self.tenant = tenant

    async def fetch(self, dataset: DkvDataset, **query):
        if dataset not in CONFIRMED_DATASETS:
            raise ValueError("unsupported DKV dataset")
        if not self.tenant.permits(dataset):
            raise DkvEnterpriseAccessBlocked(
                "DKV dataset access blocked until customer onboarding, "
                "technical-user setup and explicit dataset permission are complete"
            )
        raise DkvEnterpriseAccessBlocked(
            "DKV production call intentionally not implemented in DEV branch"
        )


@dataclass(frozen=True)
class DkvCapabilityStatus:
    enterprise_data_api: str = "confirmed"
    multi_customer_platform: str = "confirmed"
    public_sandbox: str = "not_available"
    pay_at_pump_api: str = "not_confirmed"
    station_discovery_api: str = "not_confirmed"
    fuel_price_api: str = "not_confirmed"
    revenue_share: str = "not_confirmed"
    white_label_fueling: str = "not_confirmed"
    split_settlement: str = "not_confirmed"


CAPABILITY_STATUS = DkvCapabilityStatus()
