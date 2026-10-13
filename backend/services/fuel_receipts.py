"""BidBlitz Fuel receipt/reporting models (DEV only).

These structures separate the operator's fuel receipt from BidBlitz platform
reporting. They do not create fiscal documents or execute payments.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

Q = Decimal("0.01")
PRICE_Q = Decimal("0.001")
LQ = Decimal("0.001")


def money(v) -> Decimal:
    return Decimal(str(v)).quantize(Q, rounding=ROUND_HALF_UP)


def liters(v) -> Decimal:
    return Decimal(str(v)).quantize(LQ, rounding=ROUND_HALF_UP)


def unit_price(v) -> Decimal:
    return Decimal(str(v)).quantize(PRICE_Q, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class FuelReceipt:
    receipt_id: str
    transaction_id: str
    station_name: str
    operator_name: str
    pump_number: str
    fuel_name: str
    unit_price: Decimal
    liters: Decimal
    gross_amount: Decimal
    currency: str = "EUR"
    issuer_role: str = "operator"
    fiscal_document: bool = False

    def __post_init__(self) -> None:
        required = (
            self.receipt_id, self.transaction_id, self.station_name,
            self.operator_name, self.pump_number, self.fuel_name,
        )
        if any(not str(v).strip() for v in required):
            raise ValueError("receipt fields required")
        object.__setattr__(self, "unit_price", unit_price(self.unit_price))
        object.__setattr__(self, "liters", liters(self.liters))
        object.__setattr__(self, "gross_amount", money(self.gross_amount))
        if self.unit_price <= 0 or self.liters <= 0 or self.gross_amount <= 0:
            raise ValueError("receipt amounts must be positive")
        if self.issuer_role != "operator":
            raise ValueError("V1 fuel receipt issuer must remain operator")
        if len(self.currency) != 3:
            raise ValueError("currency must be 3 letters")
        object.__setattr__(self, "currency", self.currency.upper())

    @property
    def calculated_amount(self) -> Decimal:
        return money(self.unit_price * self.liters)

    @property
    def internally_consistent(self) -> bool:
        # Fuel metering/rounding can differ by 1 cent depending on dispenser rules.
        return abs(self.calculated_amount - self.gross_amount) <= Decimal("0.01")


@dataclass(frozen=True)
class PlatformEarningRecord:
    transaction_id: str
    bidblitz_commission: Decimal
    currency: str = "EUR"

    def __post_init__(self) -> None:
        if not self.transaction_id.strip():
            raise ValueError("transaction_id required")
        amount = money(self.bidblitz_commission)
        if amount < 0:
            raise ValueError("commission cannot be negative")
        object.__setattr__(self, "bidblitz_commission", amount)
        object.__setattr__(self, "currency", self.currency.upper())
