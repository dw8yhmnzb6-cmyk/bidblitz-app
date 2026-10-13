"""BidBlitz Fuel multi-network gateway (V1).

Partner-neutral, READ-ONLY foundation. No simulated station availability or
payment execution. A provider is queried only after contract configuration.
This module is deliberately not registered as a public API route.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol, Sequence


class FuelError(Exception):
    """Base class for gateway validation/safety errors."""


class FuelUnavailable(FuelError):
    """No approved access to this partner or station."""


class FuelPaymentBlocked(FuelError):
    """Payment execution requires a separately approved implementation."""


class Network(str, Enum):
    PACE = "pace"
    CARPAY_DIEM = "carpay_diem"
    RYD = "ryd"
    KOSOVO_DIRECT = "kosovo_direct"


def _country(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Z]{2}", value):
        raise ValueError("country must be a two-letter uppercase ISO code")
    return value


@dataclass(frozen=True)
class FuelStation:
    """Provider-specific reference; not proof of station payment eligibility."""

    network: Network
    station_id: str
    name: str
    country: str
    address: str = ""
    city: str = ""
    pump_ids: tuple[str, ...] = ()
    latitude: float | None = None
    longitude: float | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.network, Network):
            raise ValueError("invalid network")
        if not self.station_id or not self.station_id.strip() or len(self.station_id) > 150:
            raise ValueError("station_id required")
        if not self.name or not self.name.strip():
            raise ValueError("name required")
        _country(self.country)
        if self.latitude is not None and not -90 <= self.latitude <= 90:
            raise ValueError("invalid latitude")
        if self.longitude is not None and not -180 <= self.longitude <= 180:
            raise ValueError("invalid longitude")
        if any(not isinstance(p, str) or not p.strip() for p in self.pump_ids):
            raise ValueError("invalid pump id")

    @property
    def external_key(self) -> str:
        # Keep each partner's ID distinct: the same physical station may appear
        # in different contracted networks, which must never be silently merged.
        return f"{self.network.value}:{self.station_id}"


@dataclass(frozen=True)
class NetworkContract:
    network: Network
    allowed_countries: frozenset[str] = field(default_factory=frozenset)
    allowed_station_ids: frozenset[str] = field(default_factory=frozenset)
    contract_signed: bool = False
    discovery_enabled: bool = False
    payment_enabled: bool = False
    # Sandbox vs live environment is evaluated by a separate payment driver.
    environment: str = "sandbox"

    def __post_init__(self) -> None:
        if not isinstance(self.network, Network):
            raise ValueError("invalid network")
        for item in self.allowed_countries:
            _country(item)
        if self.environment not in ("sandbox", "production"):
            raise ValueError("invalid environment")
        if self.payment_enabled and not self.contract_signed:
            raise ValueError("payment cannot be enabled without a signed contract")
        if self.discovery_enabled and not self.contract_signed:
            raise ValueError("discovery cannot be enabled without a signed contract")

    def permits_station(self, station: FuelStation) -> bool:
        return (
            self.contract_signed
            and self.discovery_enabled
            and station.network == self.network
            and station.country in self.allowed_countries
            # An empty allowlist permits NO stations, not all stations.
            and station.station_id in self.allowed_station_ids
        )


class ReadOnlyNetworkAdapter(Protocol):
    async def list_stations(self, country: str) -> Sequence[FuelStation]:
        """Return actual stations from an approved provider endpoint."""


@dataclass(frozen=True)
class NetworkFailure:
    network: Network
    reason: str


@dataclass(frozen=True)
class StationSearchResult:
    stations: tuple[FuelStation, ...]
    failures: tuple[NetworkFailure, ...]

    @property
    def partial(self) -> bool:
        return bool(self.failures)


class FuelGateway:
    """Fail-closed partner registry and normalized, read-only discovery."""

    def __init__(self) -> None:
        self._partners: dict[Network, tuple[NetworkContract, ReadOnlyNetworkAdapter]] = {}

    def register(self, contract: NetworkContract, adapter: ReadOnlyNetworkAdapter) -> None:
        if contract.network in self._partners:
            raise ValueError("network already registered")
        self._partners[contract.network] = (contract, adapter)

    async def search_stations(self, country: str, *, limit: int = 100) -> StationSearchResult:
        _country(country)
        if not 1 <= limit <= 500:
            raise ValueError("limit out of range")
        collected: list[FuelStation] = []
        failures: list[NetworkFailure] = []
        seen: set[str] = set()
        for network, (contract, adapter) in self._partners.items():
            if not contract.contract_signed or not contract.discovery_enabled:
                continue
            if country not in contract.allowed_countries:
                continue
            if not contract.allowed_station_ids:
                continue
            try:
                provider_rows = await adapter.list_stations(country)
                # Never trust partner country, station ID, or network blindly.
                for station in provider_rows:
                    if not isinstance(station, FuelStation):
                        raise TypeError("invalid station record")
                    if not contract.permits_station(station):
                        continue
                    if station.external_key not in seen and len(collected) < limit:
                        collected.append(station)
                        seen.add(station.external_key)
            except Exception:
                # Do not leak API tokens, raw upstream errors, or response bodies.
                failures.append(NetworkFailure(network, "provider_unavailable"))
        return StationSearchResult(tuple(collected), tuple(failures))

    def permitted_station(self, network: Network, station: FuelStation) -> bool:
        entry = self._partners.get(network)
        return bool(entry and entry[0].permits_station(station))

    async def authorize_fueling(self, *args: object, **kwargs: object) -> None:
        # Deliberately no financial API integration: authorizations must use
        # approved PSP flows, durable idempotency and reconciliation first.
        raise FuelPaymentBlocked(
            "Fuel payments disabled: licensed PSP, partner approvals, "
            "durable idempotency and settlement reconciliation required"
        )
