import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_reconciliation import (
    ReconciliationSeverity, ReconciliationStatus, build_case,
)


class TestFuelReconciliation(unittest.TestCase):
    def test_balanced_case_auto_resolved(self):
        case = build_case(
            case_id="c1", transaction_id="t1", station_id="s1",
            operator_id="op1", provider="simulator",
            pos_amount="100", psp_amount="100", bidblitz_amount="100",
        )
        self.assertTrue(case.balanced)
        self.assertEqual(case.status, ReconciliationStatus.RESOLVED)
        self.assertEqual(case.severity, ReconciliationSeverity.INFO)

    def test_small_difference_open_medium(self):
        case = build_case(
            case_id="c2", transaction_id="t2", station_id="s1",
            operator_id="op1", provider="simulator",
            pos_amount="100", psp_amount="99", bidblitz_amount="100",
        )
        self.assertFalse(case.balanced)
        self.assertEqual(case.record.difference, Decimal("1.00"))
        self.assertEqual(case.status, ReconciliationStatus.OPEN)
        self.assertEqual(case.severity, ReconciliationSeverity.MEDIUM)

    def test_large_difference_high(self):
        case = build_case(
            case_id="c3", transaction_id="t3", station_id="s1",
            operator_id="op1", provider="simulator",
            pos_amount="100", psp_amount="90", bidblitz_amount="100",
        )
        self.assertEqual(case.severity, ReconciliationSeverity.HIGH)


if __name__ == "__main__":
    unittest.main()
