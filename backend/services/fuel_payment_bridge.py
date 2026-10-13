"""Fuel -> BidBlitz Pay bridge contract (DEV only).

This module prepares deterministic payment intents and release gates but never
calls the BidBlitz Pay live route. Fuel payments remain disabled until the
provider contract, PSP/split-settlement model and reconciliation path are all
approved.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum

Q = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(str(value)).quantize(Q, rounding=ROUND_HALF_UP)


class FuelPaymentMode(str, Enum):
    DISABLED = "disabled"
    MOCK = "mock"
    LIVE = "live"


@dataclass(frozen=True)
class FuelPaymentReleaseGate:
    provider_contract_signed: bool = False
    provider_payment_approved: bool = False
    psp_approved: bool = False
    split_settlement_approved: bool = False
    merchant_role_confirmed: bool = False
    reconciliation_ready: bool = False
    webhooks_verified: bool = False

    @property
    def live_ready(self) -> bool:
        return all((
            self.provider_contract_signed,
            self.provider_payment_approved,
            self.psp_approved,
            self.split_settlement_approved,
            self.merchant_role_confirmed,
            self.reconciliation_ready,
            self.webhooks_verified,
        ))

    def missing(self) -> tuple[str, ...]:
        checks = {
            "provider_contract_signed": self.provider_contract_signed,
            "provider_payment_approved": self.provider_payment_approved,
            "psp_approved": self.psp_approved,
            "split_settlement_approved": self.split_settlement_approved,
            "merchant_role_confirmed": self.merchant_role_confirmed,
            "reconciliation_ready": self.reconciliation_ready,
            "webhooks_verified": self.webhooks_verified,
        }
        return tuple(name for name, ok in checks.items() if not ok)


@dataclass(frozen=True)
class FuelPaymentIntent:
    fuel_session_id: str
    station_id: str
    operator_id: str
    amount: Decimal
    currency: str
    description: str
    idempotency_key: str
    mode: FuelPaymentMode = FuelPaymentMode.DISABLED

    def __post_init__(self) -> None:
        for value in (self.fuel_session_id, self.station_id, self.operator_id, self.description):
            if not str(value).strip():
                raise ValueError("payment intent fields required")
        amount = money(self.amount)
        if amount <= 0:
            raise ValueError("payment amount must be positive")
        object.__setattr__(self, "amount", amount)
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValueError("currency must be 3 letters")
        object.__setattr__(self, "currency", self.currency.upper())
        if not self.idempotency_key.strip():
            raise ValueError("idempotency_key required")


class FuelPaymentBlocked(RuntimeError):
    pass


def build_idempotency_key(*, fuel_session_id: str, station_id: str, operator_id: str) -> str:
    raw = f"{fuel_session_id}|{station_id}|{operator_id}".encode()
    return "fuel_" + hashlib.sha256(raw).hexdigest()[:40]


def build_payment_intent(
    *,
    fuel_session_id: str,
    station_id: str,
    operator_id: str,
    amount,
    currency: str = "EUR",
    mode: FuelPaymentMode = FuelPaymentMode.DISABLED,
) -> FuelPaymentIntent:
    return FuelPaymentIntent(
        fuel_session_id=fuel_session_id,
        station_id=station_id,
        operator_id=operator_id,
        amount=money(amount),
        currency=currency,
        description=f"BidBlitz Fuel session {fuel_session_id}",
        idempotency_key=build_idempotency_key(
            fuel_session_id=fuel_session_id,
            station_id=station_id,
            operator_id=operator_id,
        ),
        mode=mode,
    )


def assert_payment_mode_allowed(mode: FuelPaymentMode, gate: FuelPaymentReleaseGate) -> None:
    if mode == FuelPaymentMode.LIVE and not gate.live_ready:
        raise FuelPaymentBlocked(
            "Fuel live payment blocked; missing release gates: " + ", ".join(gate.missing())
        )
    if mode == FuelPaymentMode.DISABLED:
        raise FuelPaymentBlocked("Fuel payments are disabled")


def to_bidblitz_pay_request(intent: FuelPaymentIntent, *, success_url: str, cancel_url: str, webhook_url: str) -> dict:
    if intent.mode == FuelPaymentMode.DISABLED:
        raise FuelPaymentBlocked("Cannot build BidBlitz Pay request while payments are disabled")
    return {
        "amount": float(intent.amount),
        "currency": intent.currency,
        "order_id": intent.fuel_session_id,
        "description": intent.description,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "webhook_url": webhook_url,
        "idempotency_key": intent.idempotency_key,
        "metadata": {
            "product": "fuel",
            "fuel_session_id": intent.fuel_session_id,
            "station_id": intent.station_id,
            "operator_id": intent.operator_id,
        },
        "redirect_preference": "app_or_wallet",
    }
