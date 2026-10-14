"""BidBlitz Fuel core domain V1 (DEV only).

Provider-neutral data model, capability gates, commission calculation and
fuel-session state machine. This module contains no network/payment execution.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Iterable


MONEY_Q = Decimal("0.01")
LITER_Q = Decimal("0.001")


def _money(value: Decimal | str | int | float) -> Decimal:
    return Decimal(str(value)).quantize(MONEY_Q, rounding=ROUND_HALF_UP)


def _liters(value: Decimal | str | int | float) -> Decimal:
    return Decimal(str(value)).quantize(LITER_Q, rounding=ROUND_HALF_UP)


class Provider(str, Enum):
    SIMULATOR = "simulator"
    PACE = "pace"
    SHELL = "shell"
    DKV = "dkv"
    UTA = "uta"
    RADIUS = "radius"
    CIRCLE_K = "circle_k"
    EUROWAG = "eurowag"
    LOGOS = "logos"
    MOVEYOU = "moveyou"
    HUTH = "huth"
    HECTRONIC = "hectronic"
    DFS_TOKHEIM = "dfs_tokheim"
    OPENFSC = "openfsc"
    IFSF = "ifsf"
    DIRECT = "direct"


class PumpStatus(str, Enum):
    UNKNOWN = "unknown"
    FREE = "free"
    RESERVED = "reserved"
    FUELING = "fueling"
    READY_TO_PAY = "ready_to_pay"
    OUT_OF_ORDER = "out_of_order"
    OFFLINE = "offline"


@dataclass(frozen=True)
class StationCapabilities:
    mobile_payment: bool = False
    pump_status: bool = False
    pre_authorization: bool = False
    digital_receipt: bool = False
    refund: bool = False
    price_feed: bool = False
    remote_release: bool = False

    def supports_mobile_fueling(self) -> bool:
        return self.mobile_payment and self.pump_status and self.pre_authorization


@dataclass(frozen=True)
class FuelProduct:
    code: str
    name: str
    unit_price: Decimal
    currency: str = "EUR"

    def __post_init__(self) -> None:
        if not self.code.strip() or not self.name.strip():
            raise ValueError("fuel product code/name required")
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValueError("currency must be a 3-letter code")
        price = _money(self.unit_price)
        if price <= 0:
            raise ValueError("unit_price must be positive")
        object.__setattr__(self, "unit_price", price)
        object.__setattr__(self, "currency", self.currency.upper())


@dataclass(frozen=True)
class FuelPump:
    pump_id: str
    number: str
    status: PumpStatus = PumpStatus.UNKNOWN
    product_codes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.pump_id.strip() or not self.number.strip():
            raise ValueError("pump id and number required")
        if not isinstance(self.status, PumpStatus):
            raise ValueError("invalid pump status")
        if any(not item.strip() for item in self.product_codes):
            raise ValueError("invalid product code")


@dataclass(frozen=True)
class FuelStationRecord:
    station_id: str
    operator_id: str
    provider: Provider
    provider_station_id: str
    name: str
    country: str
    capabilities: StationCapabilities = field(default_factory=StationCapabilities)
    pumps: tuple[FuelPump, ...] = ()
    products: tuple[FuelProduct, ...] = ()

    def __post_init__(self) -> None:
        required = (
            self.station_id, self.operator_id, self.provider_station_id, self.name,
        )
        if any(not value.strip() for value in required):
            raise ValueError("station identifiers/name required")
        if len(self.country) != 2 or not self.country.isalpha() or self.country != self.country.upper():
            raise ValueError("country must be uppercase ISO alpha-2")
        if not isinstance(self.provider, Provider):
            raise ValueError("invalid provider")
        product_codes = {p.code for p in self.products}
        for pump in self.pumps:
            if any(code not in product_codes for code in pump.product_codes):
                raise ValueError("pump references unknown product")


class CommissionType(str, Enum):
    PERCENTAGE = "percentage"
    PER_LITER = "per_liter"
    PER_TRANSACTION = "per_transaction"
    HYBRID = "hybrid"


@dataclass(frozen=True)
class CommissionRule:
    kind: CommissionType
    percentage: Decimal = Decimal("0")
    per_liter: Decimal = Decimal("0")
    per_transaction: Decimal = Decimal("0")

    def __post_init__(self) -> None:
        for field_name in ("percentage", "per_liter", "per_transaction"):
            value = Decimal(str(getattr(self, field_name)))
            if value < 0:
                raise ValueError(f"{field_name} cannot be negative")
            object.__setattr__(self, field_name, value)
        if self.percentage > 100:
            raise ValueError("percentage cannot exceed 100")

    def calculate(self, *, gross_amount: Decimal | str | int | float,
                  liters: Decimal | str | int | float) -> Decimal:
        gross = _money(gross_amount)
        volume = _liters(liters)
        if gross < 0 or volume < 0:
            raise ValueError("gross amount/liters cannot be negative")

        amount = Decimal("0")
        if self.kind in (CommissionType.PERCENTAGE, CommissionType.HYBRID):
            amount += gross * self.percentage / Decimal("100")
        if self.kind in (CommissionType.PER_LITER, CommissionType.HYBRID):
            amount += volume * self.per_liter
        if self.kind in (CommissionType.PER_TRANSACTION, CommissionType.HYBRID):
            amount += self.per_transaction
        return amount.quantize(MONEY_Q, rounding=ROUND_HALF_UP)


class SessionState(str, Enum):
    CREATED = "created"
    STATION_CONFIRMED = "station_confirmed"
    PUMP_SELECTED = "pump_selected"
    PAYMENT_AUTHORIZED = "payment_authorized"
    FUELING = "fueling"
    AMOUNT_CONFIRMED = "amount_confirmed"
    CAPTURE_PENDING = "capture_pending"
    PAID = "paid"
    CLOSED = "closed"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"
    UNKNOWN = "unknown"
    REFUND_PENDING = "refund_pending"
    REFUNDED = "refunded"
    MANUAL_REVIEW = "manual_review"


_ALLOWED: dict[SessionState, frozenset[SessionState]] = {
    SessionState.CREATED: frozenset({SessionState.STATION_CONFIRMED, SessionState.CANCELLED}),
    SessionState.STATION_CONFIRMED: frozenset({SessionState.PUMP_SELECTED, SessionState.CANCELLED}),
    SessionState.PUMP_SELECTED: frozenset({
        SessionState.PAYMENT_AUTHORIZED, SessionState.DECLINED,
        SessionState.CANCELLED, SessionState.TIMEOUT, SessionState.UNKNOWN,
    }),
    SessionState.PAYMENT_AUTHORIZED: frozenset({
        SessionState.FUELING, SessionState.CANCELLED,
        SessionState.TIMEOUT, SessionState.UNKNOWN,
    }),
    SessionState.FUELING: frozenset({
        SessionState.AMOUNT_CONFIRMED, SessionState.TIMEOUT, SessionState.UNKNOWN,
    }),
    SessionState.AMOUNT_CONFIRMED: frozenset({
        SessionState.CAPTURE_PENDING, SessionState.UNKNOWN, SessionState.MANUAL_REVIEW,
    }),
    SessionState.CAPTURE_PENDING: frozenset({
        SessionState.PAID, SessionState.UNKNOWN, SessionState.MANUAL_REVIEW,
    }),
    SessionState.PAID: frozenset({
        SessionState.CLOSED, SessionState.REFUND_PENDING, SessionState.MANUAL_REVIEW,
    }),
    SessionState.REFUND_PENDING: frozenset({
        SessionState.REFUNDED, SessionState.UNKNOWN, SessionState.MANUAL_REVIEW,
    }),
    SessionState.UNKNOWN: frozenset({SessionState.MANUAL_REVIEW}),
    SessionState.TIMEOUT: frozenset({SessionState.MANUAL_REVIEW}),
    SessionState.DECLINED: frozenset(),
    SessionState.CANCELLED: frozenset(),
    SessionState.CLOSED: frozenset(),
    SessionState.REFUNDED: frozenset(),
    SessionState.MANUAL_REVIEW: frozenset(),
}


@dataclass
class FuelSession:
    session_id: str
    station_id: str
    state: SessionState = SessionState.CREATED
    pump_id: str | None = None
    payment_reference: str | None = None
    gross_amount: Decimal | None = None
    liters: Decimal | None = None
    history: list[SessionState] = field(default_factory=lambda: [SessionState.CREATED])

    def transition(self, target: SessionState) -> None:
        if not isinstance(target, SessionState):
            raise ValueError("invalid session state")
        allowed = _ALLOWED[self.state]
        if target not in allowed:
            raise ValueError(f"invalid transition {self.state.value}->{target.value}")
        self.state = target
        self.history.append(target)

    def set_pump(self, pump_id: str) -> None:
        if self.state != SessionState.STATION_CONFIRMED:
            raise ValueError("pump can only be selected after station confirmation")
        if not pump_id.strip():
            raise ValueError("pump_id required")
        self.pump_id = pump_id
        self.transition(SessionState.PUMP_SELECTED)

    def set_authorized(self, payment_reference: str) -> None:
        if self.state != SessionState.PUMP_SELECTED:
            raise ValueError("authorization requires selected pump")
        if not payment_reference.strip():
            raise ValueError("payment reference required")
        self.payment_reference = payment_reference
        self.transition(SessionState.PAYMENT_AUTHORIZED)

    def confirm_amount(self, *, gross_amount: Decimal | str | int | float,
                       liters: Decimal | str | int | float) -> None:
        if self.state != SessionState.FUELING:
            raise ValueError("amount can only be confirmed while fueling")
        gross = _money(gross_amount)
        volume = _liters(liters)
        if gross <= 0 or volume <= 0:
            raise ValueError("gross amount and liters must be positive")
        self.gross_amount = gross
        self.liters = volume
        self.transition(SessionState.AMOUNT_CONFIRMED)


class SimulatorCatalog:
    """Deterministic local-only catalog for UI/API development."""

    def __init__(self, stations: Iterable[FuelStationRecord]) -> None:
        station_list = tuple(stations)
        ids = [s.station_id for s in station_list]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate station_id")
        if any(s.provider != Provider.SIMULATOR for s in station_list):
            raise ValueError("simulator catalog accepts simulator stations only")
        self._stations = {s.station_id: s for s in station_list}

    def list_stations(self, country: str) -> tuple[FuelStationRecord, ...]:
        if len(country) != 2 or country != country.upper():
            raise ValueError("country must be uppercase ISO alpha-2")
        return tuple(s for s in self._stations.values() if s.country == country)

    def get_station(self, station_id: str) -> FuelStationRecord | None:
        return self._stations.get(station_id)
