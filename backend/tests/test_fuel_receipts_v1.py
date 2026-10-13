import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_receipts import FuelReceipt, PlatformEarningRecord


class TestFuelReceiptsV1(unittest.TestCase):
    def test_operator_receipt_is_consistent(self):
        r = FuelReceipt(
            receipt_id="r-1",
            transaction_id="tx-1",
            station_name="Demo Station",
            operator_name="Demo Operator",
            pump_number="4",
            fuel_name="Super E10",
            unit_price=Decimal("1.651"),
            liters=Decimal("31.700"),
            gross_amount=Decimal("52.34"),
        )
        self.assertTrue(r.internally_consistent)
        self.assertEqual(r.issuer_role, "operator")
        self.assertFalse(r.fiscal_document)

    def test_bidblitz_is_not_fuel_receipt_issuer(self):
        with self.assertRaises(ValueError):
            FuelReceipt(
                receipt_id="r-1", transaction_id="tx-1",
                station_name="S", operator_name="O", pump_number="1",
                fuel_name="Diesel", unit_price="1.50", liters="10",
                gross_amount="15", issuer_role="bidblitz",
            )

    def test_platform_earning_is_separate(self):
        earning = PlatformEarningRecord("tx-1", Decimal("3.50"))
        self.assertEqual(earning.bidblitz_commission, Decimal("3.50"))


if __name__ == "__main__":
    unittest.main()
