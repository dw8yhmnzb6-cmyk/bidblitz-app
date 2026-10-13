import asyncio
import unittest

from backend.routes.fuel_dev import (
    fuel_status,
    get_fuel_station,
    list_fuel_stations,
    prepare_fuel_session,
)


class TestFuelDevRoutes(unittest.TestCase):
    def test_status_is_dev_and_payments_off(self):
        payload = asyncio.run(fuel_status())
        self.assertEqual(payload["status"], "development")
        self.assertFalse(payload["payments_enabled"])
        self.assertFalse(payload["external_networks_enabled"])

    def test_list_uses_only_simulator(self):
        payload = asyncio.run(list_fuel_stations("DE"))
        self.assertEqual(payload["mode"], "simulator")
        self.assertFalse(payload["payments_enabled"])
        self.assertGreaterEqual(len(payload["stations"]), 1)
        self.assertTrue(all(s["provider"] == "simulator" for s in payload["stations"]))

    def test_station_has_prices_and_pumps(self):
        payload = asyncio.run(get_fuel_station("sim-de-berlin-001"))
        station = payload["station"]
        self.assertTrue(station["products"])
        self.assertTrue(station["pumps"])
        self.assertTrue(station["capabilities"]["mobile_payment"])

    def test_prepare_never_executes_payment(self):
        payload = asyncio.run(prepare_fuel_session("sim-de-berlin-001", "berlin-1"))
        self.assertEqual(payload["status"], "blocked_until_payment_integration")
        self.assertFalse(payload["payments_enabled"])

    def test_busy_pump_is_rejected(self):
        with self.assertRaises(Exception) as ctx:
            asyncio.run(prepare_fuel_session("sim-de-berlin-001", "berlin-2"))
        self.assertEqual(getattr(ctx.exception, "status_code", None), 409)


if __name__ == "__main__":
    unittest.main()
