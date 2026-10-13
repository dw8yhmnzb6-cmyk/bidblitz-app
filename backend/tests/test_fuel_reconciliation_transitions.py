import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_reconciliation import (
    ReconciliationStatus, validate_status_transition,
)


class TestFuelReconciliationTransitions(unittest.TestCase):
    def test_open_can_move_to_reviewing_or_terminal(self):
        validate_status_transition(ReconciliationStatus.OPEN, ReconciliationStatus.REVIEWING)
        validate_status_transition(ReconciliationStatus.OPEN, ReconciliationStatus.RESOLVED)
        validate_status_transition(ReconciliationStatus.OPEN, ReconciliationStatus.IGNORED)

    def test_reviewing_can_resolve_or_ignore(self):
        validate_status_transition(ReconciliationStatus.REVIEWING, ReconciliationStatus.RESOLVED)
        validate_status_transition(ReconciliationStatus.REVIEWING, ReconciliationStatus.IGNORED)

    def test_terminal_states_are_final(self):
        with self.assertRaises(ValueError):
            validate_status_transition(ReconciliationStatus.RESOLVED, ReconciliationStatus.REVIEWING)
        with self.assertRaises(ValueError):
            validate_status_transition(ReconciliationStatus.IGNORED, ReconciliationStatus.OPEN)


if __name__ == "__main__":
    unittest.main()
