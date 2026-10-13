import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_core import (
    CommissionRule, CommissionType, FuelProduct, FuelPump, FuelSession,
    FuelStationRecord, Provider, PumpStatus, SessionState, SimulatorCatalog,
    StationCapabilities,
)


class TestFuelCoreV1(unittest.TestCase):
    def station(self):
        products = (
            FuelProduct("e10", "Super E10", Decimal("1.629")),
            FuelProduct("diesel", "Diesel", Decimal("1.579")),
        )
        pumps = (
            FuelPump("p1", "1", PumpStatus.FREE, ("e10", "diesel")),
            FuelPump("p2", "2", PumpStatus.FUELING, ("e10",)),
        )
        return FuelStationRecord(
            station_id="sim-de-001",
            operator_id="op-demo",
            provider=Provider.SIMULATOR,
            provider_station_id="demo-001",
            name="BidBlitz Simulator Berlin",
            country="DE",
            capabilities=StationCapabilities(
                mobile_payment=True, pump_status=True, pre_authorization=True,
                digital_receipt=True, refund=True, price_feed=True,
            ),
            pumps=pumps,
            products=products,
        )

    def test_station_capabilities_and_catalog(self):
        station = self.station()
        self.assertTrue(station.capabilities.supports_mobile_fueling())
        catalog = SimulatorCatalog([station])
        self.assertEqual(catalog.list_stations("DE")[0].station_id, "sim-de-001")
        self.assertEqual(catalog.list_stations("AT"), ())
        self.assertIsNone(catalog.get_station("missing"))

    def test_invalid_product_reference_fails_closed(self):
        with self.assertRaises(ValueError):
            FuelStationRecord(
                station_id="x", operator_id="o", provider=Provider.SIMULATOR,
                provider_station_id="px", name="X", country="DE",
                pumps=(FuelPump("p", "1", PumpStatus.FREE, ("missing",)),),
                products=(),
            )

    def test_commission_percentage(self):
        rule = CommissionRule(CommissionType.PERCENTAGE, percentage=Decimal("5"))
        self.assertEqual(rule.calculate(gross_amount="100", liters="50"), Decimal("5.00"))

    def test_commission_per_liter(self):
        rule = CommissionRule(CommissionType.PER_LITER, per_liter=Decimal("0.03"))
        self.assertEqual(rule.calculate(gross_amount="100", liters="42.125"), Decimal("1.26"))

    def test_commission_hybrid(self):
        rule = CommissionRule(
            CommissionType.HYBRID,
            percentage=Decimal("2"),
            per_liter=Decimal("0.02"),
            per_transaction=Decimal("0.10"),
        )
        self.assertEqual(rule.calculate(gross_amount="80", liters="40"), Decimal("2.50"))

    def test_commission_validation(self):
        with self.assertRaises(ValueError):
            CommissionRule(CommissionType.PERCENTAGE, percentage=Decimal("101"))
        with self.assertRaises(ValueError):
            CommissionRule(CommissionType.PER_LITER, per_liter=Decimal("-0.01"))

    def test_happy_path_state_machine(self):
        session = FuelSession("s1", "sim-de-001")
        session.transition(SessionState.STATION_CONFIRMED)
        session.set_pump("p1")
        session.set_authorized("auth-1")
        session.transition(SessionState.FUELING)
        session.confirm_amount(gross_amount="52.34", liters="31.700")
        session.transition(SessionState.CAPTURE_PENDING)
        session.transition(SessionState.PAID)
        session.transition(SessionState.CLOSED)
        self.assertEqual(session.state, SessionState.CLOSED)
        self.assertEqual(session.gross_amount, Decimal("52.34"))
        self.assertEqual(session.liters, Decimal("31.700"))

    def test_unknown_never_returns_to_payment_automatically(self):
        session = FuelSession("s1", "sim-de-001")
        session.transition(SessionState.STATION_CONFIRMED)
        session.set_pump("p1")
        session.transition(SessionState.UNKNOWN)
        with self.assertRaises(ValueError):
            session.transition(SessionState.PAYMENT_AUTHORIZED)
        session.transition(SessionState.MANUAL_REVIEW)
        self.assertEqual(session.state, SessionState.MANUAL_REVIEW)

    def test_invalid_state_jump_blocked(self):
        session = FuelSession("s1", "sim-de-001")
        with self.assertRaises(ValueError):
            session.transition(SessionState.PAID)

    def test_price_and_country_validation(self):
        with self.assertRaises(ValueError):
            FuelProduct("e10", "E10", Decimal("0"))
        with self.assertRaises(ValueError):
            FuelStationRecord(
                station_id="x", operator_id="o", provider=Provider.SIMULATOR,
                provider_station_id="p", name="X", country="de",
            )


if __name__ == "__main__":
    unittest.main()
