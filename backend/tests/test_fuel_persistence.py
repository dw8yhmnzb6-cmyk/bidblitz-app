import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_core import FuelSession, SessionState
from services.fuel_persistence import (
    COLLECTION, REQUIRED_INDEXES, PersistedFuelSession,
    optimistic_update_document, optimistic_update_filter,
)


class TestFuelPersistenceContract(unittest.TestCase):
    def test_round_trip_preserves_session_state(self):
        s = FuelSession("s1", "st1")
        s.transition(SessionState.STATION_CONFIRMED)
        s.set_pump("p1")
        s.set_authorized("auth1")
        s.transition(SessionState.FUELING)
        s.confirm_amount(gross_amount=Decimal("52.34"), liters=Decimal("31.700"))
        persisted = PersistedFuelSession(
            session=s,
            operator_id="op1",
            provider="simulator",
            idempotency_key="fuel-key",
            created_at="2026-10-13T10:00:00+00:00",
            updated_at="2026-10-13T10:01:00+00:00",
        )
        restored = PersistedFuelSession.from_document(persisted.to_document())
        self.assertEqual(restored.session.state, SessionState.AMOUNT_CONFIRMED)
        self.assertEqual(restored.session.gross_amount, Decimal("52.34"))
        self.assertEqual(restored.session.liters, Decimal("31.700"))
        self.assertEqual(restored.session.history, s.history)

    def test_required_unique_indexes_exist(self):
        self.assertEqual(COLLECTION, "fuel_sessions")
        names = {item["name"] for item in REQUIRED_INDEXES}
        self.assertIn("fuel_session_id_unique", names)
        self.assertIn("fuel_idempotency_unique", names)
        unique = {item["name"]: item["unique"] for item in REQUIRED_INDEXES}
        self.assertTrue(unique["fuel_session_id_unique"])
        self.assertTrue(unique["fuel_idempotency_unique"])

    def test_optimistic_locking_contract(self):
        s = FuelSession("s1", "st1")
        p = PersistedFuelSession(
            session=s,
            operator_id="op1",
            provider="simulator",
            idempotency_key="fuel-key",
            created_at="2026-10-13T10:00:00+00:00",
            updated_at="2026-10-13T10:01:00+00:00",
            version=3,
        )
        self.assertEqual(optimistic_update_filter("s1", 3), {"session_id": "s1", "version": 3})
        self.assertEqual(optimistic_update_document(p)["$set"]["version"], 4)


if __name__ == "__main__":
    unittest.main()
