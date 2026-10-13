"""In-memory DEV-only Fuel session simulator.

Strictly synthetic. It never contacts PSPs/providers, never authorizes cards,
never releases a real pump, and must never be used as production persistence.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from itertools import count

from services.fuel_core import FuelSession, SessionState
from services.fuel_receipts import FuelReceipt

_COUNTER = count(1)


@dataclass
class SimulatedFuelSession:
    session: FuelSession
    station_name: str
    operator_name: str
    pump_number: str
    fuel_code: str
    fuel_name: str
    unit_price: Decimal
    currency: str = "EUR"
    receipt: FuelReceipt | None = None

    def payload(self) -> dict:
        s = self.session
        return {
            "session_id": s.session_id,
            "station_id": s.station_id,
            "station_name": self.station_name,
            "pump_id": s.pump_id,
            "pump_number": self.pump_number,
            "fuel_code": self.fuel_code,
            "fuel_name": self.fuel_name,
            "unit_price": str(self.unit_price),
            "currency": self.currency,
            "state": s.state.value,
            "history": [item.value for item in s.history],
            "gross_amount": str(s.gross_amount) if s.gross_amount is not None else None,
            "liters": str(s.liters) if s.liters is not None else None,
            "payment_reference": s.payment_reference,
            "simulated": True,
            "real_payment_executed": False,
            "real_pump_released": False,
            "receipt_id": self.receipt.receipt_id if self.receipt else None,
        }


class FuelSimulatorStore:
    def __init__(self) -> None:
        self._items: dict[str, SimulatedFuelSession] = {}

    def create(
        self,
        *,
        station_id: str,
        station_name: str,
        operator_name: str,
        pump_id: str,
        pump_number: str,
        fuel_code: str,
        fuel_name: str,
        unit_price: Decimal,
        currency: str = "EUR",
    ) -> SimulatedFuelSession:
        session_id = f"fuel-sim-{next(_COUNTER):06d}"
        session = FuelSession(session_id=session_id, station_id=station_id)
        session.transition(SessionState.STATION_CONFIRMED)
        session.set_pump(pump_id)
        item = SimulatedFuelSession(
            session=session,
            station_name=station_name,
            operator_name=operator_name,
            pump_number=pump_number,
            fuel_code=fuel_code,
            fuel_name=fuel_name,
            unit_price=unit_price,
            currency=currency,
        )
        self._items[session_id] = item
        return item

    def get(self, session_id: str) -> SimulatedFuelSession | None:
        return self._items.get(session_id)

    def list(self) -> tuple[SimulatedFuelSession, ...]:
        return tuple(self._items.values())

    def authorize_demo(self, session_id: str) -> SimulatedFuelSession:
        item = self._require(session_id)
        if item.session.state != SessionState.PUMP_SELECTED:
            raise ValueError("session is not ready for simulated authorization")
        item.session.set_authorized(f"SIM-AUTH-{session_id}")
        return item

    def start_demo_fueling(self, session_id: str) -> SimulatedFuelSession:
        item = self._require(session_id)
        if item.session.state != SessionState.PAYMENT_AUTHORIZED:
            raise ValueError("session is not authorized in simulator")
        item.session.transition(SessionState.FUELING)
        return item

    def complete_demo_fueling(
        self,
        session_id: str,
        *,
        liters: Decimal,
    ) -> SimulatedFuelSession:
        item = self._require(session_id)
        if item.session.state != SessionState.FUELING:
            raise ValueError("session is not fueling")
        gross = (item.unit_price * liters).quantize(Decimal("0.01"))
        item.session.confirm_amount(gross_amount=gross, liters=liters)
        item.session.transition(SessionState.CAPTURE_PENDING)
        item.session.transition(SessionState.PAID)
        item.session.transition(SessionState.CLOSED)
        item.receipt = FuelReceipt(
            receipt_id=f"receipt-{session_id}",
            transaction_id=f"tx-{session_id}",
            station_name=item.station_name,
            operator_name=item.operator_name,
            pump_number=item.pump_number,
            fuel_name=item.fuel_name,
            unit_price=item.unit_price,
            liters=liters,
            gross_amount=gross,
            currency=item.currency,
            issuer_role="operator",
            fiscal_document=False,
        )
        return item

    def _require(self, session_id: str) -> SimulatedFuelSession:
        item = self.get(session_id)
        if not item:
            raise KeyError("session not found")
        return item


STORE = FuelSimulatorStore()
