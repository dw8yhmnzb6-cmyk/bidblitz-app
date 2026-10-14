import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_core import SessionState
from services.fuel_simulator_sessions import FuelSimulatorStore


class TestFuelSimulatorSessions(unittest.TestCase):
    def setUp(self):
        self.store = FuelSimulatorStore()
        self.item = self.store.create(
            station_id="s1",
            station_name="Demo Station",
            operator_name="Demo Operator",
            pump_id="p1",
            pump_number="1",
            fuel_code="e10",
            fuel_name="Super E10",
            unit_price=Decimal("1.651"),
        )

    def test_create_stops_before_authorization(self):
        self.assertEqual(self.item.session.state, SessionState.PUMP_SELECTED)
        self.assertFalse(self.item.payload()["real_payment_executed"])
        self.assertFalse(self.item.payload()["real_pump_released"])

    def test_full_demo_flow_creates_non_fiscal_operator_receipt(self):
        self.store.authorize_demo(self.item.session.session_id)
        self.store.start_demo_fueling(self.item.session.session_id)
        done = self.store.complete_demo_fueling(
            self.item.session.session_id,
            liters=Decimal("31.700"),
        )
        self.assertEqual(done.session.state, SessionState.CLOSED)
        self.assertIsNotNone(done.receipt)
        self.assertFalse(done.receipt.fiscal_document)
        self.assertEqual(done.receipt.issuer_role, "operator")
        self.assertFalse(done.payload()["real_payment_executed"])

    def test_wrong_order_fails(self):
        with self.assertRaises(ValueError):
            self.store.start_demo_fueling(self.item.session.session_id)

    def test_missing_session_fails(self):
        with self.assertRaises(KeyError):
            self.store.authorize_demo("missing")


if __name__ == "__main__":
    unittest.main()
