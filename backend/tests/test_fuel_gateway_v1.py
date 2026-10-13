"""Offline contract/safety tests for the BidBlitz Fuel V1 gateway.

Run: python -m unittest discover -s backend/tests -p test_fuel_gateway_v1.py -v
No third-party credentials, database or internet access required.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_gateway import (
    FuelGateway, FuelPaymentBlocked, FuelStation, Network,
    NetworkContract,
)


class FakeNetwork:
    def __init__(self, stations=(), error=None):
        self.stations = stations
        self.error = error
        self.calls = 0

    async def list_stations(self, country):
        self.calls += 1
        if self.error:
            raise RuntimeError(self.error)
        return self.stations


def station(network=Network.PACE, station_id="de-101", country="DE"):
    return FuelStation(
        network=network, station_id=station_id, name="Provider test station",
        country=country, city="Berlin", pump_ids=("1", "2")
    )


def contract(network=Network.PACE, **overrides):
    args = dict(
        network=network, contract_signed=True, discovery_enabled=True,
        allowed_countries=frozenset({"DE"}),
        allowed_station_ids=frozenset({"de-101"}),
    )
    args.update(overrides)
    return NetworkContract(**args)


class TestSafety(unittest.IsolatedAsyncioTestCase):
    async def test_no_contract_means_zero_external_calls(self):
        gateway = FuelGateway()
        provider = FakeNetwork([station()])
        gateway.register(NetworkContract(network=Network.PACE), provider)
        result = await gateway.search_stations("DE")
        self.assertEqual(result.stations, ())
        self.assertEqual(provider.calls, 0)

    async def test_empty_station_allowlist_fails_closed(self):
        gateway = FuelGateway()
        provider = FakeNetwork([station()])
        gateway.register(contract(allowed_station_ids=frozenset()), provider)
        self.assertEqual((await gateway.search_stations("DE")).stations, ())
        self.assertEqual(provider.calls, 0)

    async def test_only_approved_network_country_station(self):
        gateway = FuelGateway()
        provider = FakeNetwork([
            station(), station(station_id="unapproved"),
            station(country="FR"), station(network=Network.RYD),
        ])
        gateway.register(contract(), provider)
        result = await gateway.search_stations("DE")
        self.assertEqual([s.external_key for s in result.stations], ["pace:de-101"])
        self.assertFalse(result.partial)

    async def test_other_country_skips_provider(self):
        gateway = FuelGateway()
        provider = FakeNetwork([station()])
        gateway.register(contract(), provider)
        self.assertEqual((await gateway.search_stations("AT")).stations, ())
        self.assertEqual(provider.calls, 0)

    async def test_upstream_error_is_sanitized(self):
        gateway = FuelGateway()
        provider = FakeNetwork(error="Bearer secret-test-token 401")
        gateway.register(contract(), provider)
        result = await gateway.search_stations("DE")
        self.assertEqual(result.stations, ())
        self.assertTrue(result.partial)
        self.assertEqual(result.failures[0].reason, "provider_unavailable")
        self.assertNotIn("secret-test-token", str(result))

    async def test_one_network_failure_does_not_hide_other_network(self):
        gateway = FuelGateway()
        gateway.register(contract(), FakeNetwork(error="timeout"))
        gateway.register(
            contract(network=Network.RYD, allowed_station_ids=frozenset({"de-101"})),
            FakeNetwork([station(network=Network.RYD)])
        )
        result = await gateway.search_stations("DE")
        self.assertEqual([s.external_key for s in result.stations], ["ryd:de-101"])
        self.assertTrue(result.partial)

    async def test_no_automatic_cross_network_deduplication(self):
        gateway = FuelGateway()
        gateway.register(contract(), FakeNetwork([station(), station()]))
        gateway.register(
            contract(network=Network.RYD),
            FakeNetwork([station(network=Network.RYD)])
        )
        result = await gateway.search_stations("DE")
        self.assertEqual(len(result.stations), 2)
        self.assertEqual({s.external_key for s in result.stations},
                         {"pace:de-101", "ryd:de-101"})

    async def test_unsafe_payments_always_blocked(self):
        gateway = FuelGateway()
        with self.assertRaises(FuelPaymentBlocked):
            await gateway.authorize_fueling("de-101", "pump-1", 100)

    async def test_input_validation(self):
        gateway = FuelGateway()
        with self.assertRaises(ValueError):
            await gateway.search_stations("de")
        with self.assertRaises(ValueError):
            await gateway.search_stations("DE", limit=0)
        with self.assertRaises(ValueError):
            await gateway.search_stations("DE", limit=501)
        with self.assertRaises(ValueError):
            FuelStation(network=Network.PACE, station_id="", name="X", country="DE")
        with self.assertRaises(ValueError):
            FuelStation(network=Network.PACE, station_id="ok", name="X", country="DE", latitude=93)

    async def test_contract_cannot_enable_payments_without_signature(self):
        with self.assertRaises(ValueError):
            NetworkContract(network=Network.PACE, payment_enabled=True)
        with self.assertRaises(ValueError):
            NetworkContract(network=Network.PACE, discovery_enabled=True)

    async def test_duplicate_network_registration_rejected(self):
        gateway = FuelGateway()
        gateway.register(contract(), FakeNetwork())
        with self.assertRaises(ValueError):
            gateway.register(contract(), FakeNetwork())


if __name__ == "__main__":
    unittest.main()
