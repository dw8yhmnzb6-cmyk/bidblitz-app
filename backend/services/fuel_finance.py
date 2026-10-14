"""BidBlitz Fuel settlement and operator contract domain (DEV only).

Pure calculation/state module. It never moves money. PSP execution and real
settlement remain disabled until partner, PSP and legal approvals exist.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum

from services.fuel_core import CommissionRule

Q = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(str(value)).quantize(Q, rounding=ROUND_HALF_UP)


class FeeOwner(str, Enum):
    OPERATOR = "operator"
    BIDBLITZ = "bidblitz"
    SHARED = "shared"


class MerchantRole(str, Enum):
    OPERATOR = "operator"
    PARTNER = "partner"


@dataclass(frozen=True)
class OperatorContract:
    operator_id: str
    commission_rule: CommissionRule
    merchant_of_record: MerchantRole = MerchantRole.OPERATOR
    supplier_of_record: MerchantRole = MerchantRole.OPERATOR
    payment_fee_owner: FeeOwner = FeeOwner.OPERATOR
    signed: bool = False
    settlement_enabled: bool = False
    currency: str = "EUR"

    def __post_init__(self) -> None:
        if not self.operator_id.strip():
            raise ValueError("operator_id required")
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValueError("currency must be 3-letter code")
        object.__setattr__(self, "currency", self.currency.upper())
        if self.settlement_enabled and not self.signed:
            raise ValueError("settlement cannot be enabled without signed contract")
        if self.merchant_of_record == MerchantRole.OPERATOR and self.supplier_of_record != MerchantRole.OPERATOR:
            raise ValueError("operator merchant role requires operator supplier role in V1")


@dataclass(frozen=True)
class SettlementAllocation:
    gross_amount: Decimal
    payment_fee: Decimal
    bidblitz_commission: Decimal
    operator_amount: Decimal
    currency: str
    fee_owner: FeeOwner

    def __post_init__(self) -> None:
        values = (self.gross_amount, self.payment_fee, self.bidblitz_commission, self.operator_amount)
        if any(v < 0 for v in values):
            raise ValueError("allocation values cannot be negative")
        if self.bidblitz_commission + self.operator_amount + self.payment_fee != self.gross_amount:
            raise ValueError("allocation must balance exactly")


def allocate_transaction(
    *,
    contract: OperatorContract,
    gross_amount,
    liters,
    payment_fee,
) -> SettlementAllocation:
    if not contract.signed or not contract.settlement_enabled:
        raise ValueError("contract is not enabled for settlement")

    gross = money(gross_amount)
    fee = money(payment_fee)
    if gross <= 0:
        raise ValueError("gross_amount must be positive")
    if fee < 0 or fee > gross:
        raise ValueError("invalid payment_fee")

    commission = contract.commission_rule.calculate(
        gross_amount=gross,
        liters=liters,
    )
    if commission > gross:
        raise ValueError("commission exceeds gross amount")

    if contract.payment_fee_owner == FeeOwner.OPERATOR:
        operator = gross - commission - fee
        bidblitz = commission
    elif contract.payment_fee_owner == FeeOwner.BIDBLITZ:
        operator = gross - commission
        bidblitz = commission - fee
        if bidblitz < 0:
            raise ValueError("payment fee exceeds BidBlitz commission")
    else:
        half = (fee / Decimal("2")).quantize(Q, rounding=ROUND_HALF_UP)
        other_half = fee - half
        operator = gross - commission - half
        bidblitz = commission - other_half
        if bidblitz < 0:
            raise ValueError("shared payment fee exceeds BidBlitz commission")

    # Keep explicit payment fee in the allocation while ensuring the sum equals gross.
    # For BIDBLITZ/SHARED fee ownership, operator+bidblitz no longer include the fee.
    return SettlementAllocation(
        gross_amount=gross,
        payment_fee=fee,
        bidblitz_commission=money(bidblitz),
        operator_amount=money(operator),
        currency=contract.currency,
        fee_owner=contract.payment_fee_owner,
    )


@dataclass(frozen=True)
class ReconciliationRecord:
    transaction_id: str
    pos_amount: Decimal
    psp_amount: Decimal
    bidblitz_amount: Decimal

    def __post_init__(self) -> None:
        if not self.transaction_id.strip():
            raise ValueError("transaction_id required")
        object.__setattr__(self, "pos_amount", money(self.pos_amount))
        object.__setattr__(self, "psp_amount", money(self.psp_amount))
        object.__setattr__(self, "bidblitz_amount", money(self.bidblitz_amount))

    @property
    def balanced(self) -> bool:
        return self.pos_amount == self.psp_amount == self.bidblitz_amount

    @property
    def difference(self) -> Decimal:
        values = (self.pos_amount, self.psp_amount, self.bidblitz_amount)
        return max(values) - min(values)
