"""Offline Fuel quote tests, no credentials or payment execution."""
import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_business_model import preview_fuel_commercial_offer


class TestFuelCommercialQuote(unittest.TestCase):
    def test_100k_percent_vs_liter(self):
        q = preview_fuel_commercial_offer(
            monthly_turnover="100000", price_per_liter="2.20",
            percent_rate="0.5", cent_per_liter="1",
            average_ticket="50", psp_percent="0", psp_fixed="0",
        )
        self.assertEqual(q["estimated_liters"], "45454.545")
        self.assertEqual(q["percentage_model"]["commission_before_cost"], "500.00")
        self.assertEqual(q["per_liter_model"]["commission_before_cost"], "454.55")
        self.assertEqual(q["estimated_transactions"], 2000)
        self.assertFalse(q["payments_enabled"])

    def test_psp_cost_if_bidblitz_bears_card_fees(self):
        q = preview_fuel_commercial_offer(
            payment_fee_owner="bidblitz", psp_percent="1.5",
            psp_fixed="0.25", percent_rate="0.2",
        )
        self.assertEqual(q["estimated_psp_cost"], "2000.00")
        self.assertEqual(q["percentage_model"]["after_allocated_psp_cost"], "-1800.00")

    def test_psp_cost_if_operator_bears_fee(self):
        q = preview_fuel_commercial_offer(
            payment_fee_owner="operator", psp_percent="1.5",
            psp_fixed="0.25", percent_rate="0.2",
        )
        self.assertEqual(q["bidblitz_psp_cost"], "0.00")
        self.assertEqual(q["percentage_model"]["after_allocated_psp_cost"], "200.00")

    def test_shared_fee_cost(self):
        q = preview_fuel_commercial_offer(
            payment_fee_owner="shared", psp_percent="1.5", psp_fixed="0.25",
        )
        self.assertEqual(q["bidblitz_psp_cost"], "1000.00")

    def test_net_fee_basis_with_vat(self):
        q = preview_fuel_commercial_offer(
            fee_basis="net", vat_percent="19", percent_rate="1",
        )
        self.assertEqual(q["monthly_percentage_basis"], "84033.61")
        self.assertEqual(q["percentage_model"]["commission_before_cost"], "840.34")

    def test_zero_turnover_does_not_charge_transactions(self):
        q = preview_fuel_commercial_offer(monthly_turnover="0", psp_fixed="0.25")
        self.assertEqual(q["estimated_transactions"], 0)
        self.assertEqual(q["estimated_psp_cost"], "0.00")
        self.assertEqual(q["estimated_liters"], "0.000")

    def test_100_station_projection_is_not_conflated_with_per_station_revenue(self):
        quote = preview_fuel_commercial_offer(
            monthly_turnover="100000",
            station_count="100",
            price_per_liter="2.2",
            percent_rate="0.5",
            cent_per_liter="1",
            psp_percent="1.5",
            psp_fixed="0.25",
            payment_fee_owner="bidblitz",
        )
        projection = quote["portfolio_projection"]
        self.assertEqual(quote["station_count"], 100)
        self.assertEqual(quote["percentage_model"]["commission_before_cost"], "500.00")
        self.assertEqual(projection["monthly_turnover_gross"], "10000000.00")
        self.assertEqual(projection["monthly_transactions"], 200000)
        self.assertEqual(projection["monthly_psp_cost"], "200000.00")
        self.assertEqual(projection["percentage_model"]["monthly_commission_before_cost"], "50000.00")
        self.assertEqual(projection["percentage_model"]["monthly_after_allocated_psp_cost"], "-150000.00")
        self.assertEqual(projection["percentage_model"]["annual_commission_before_cost"], "600000.00")
        self.assertEqual(projection["per_liter_model"]["monthly_commission_before_cost"], "45455.00")
        self.assertEqual(projection["assumption"], "all_stations_have_identical_monthly_turnover_and_fee_terms")

    def test_default_one_station_projection(self):
        quote = preview_fuel_commercial_offer(percent_rate="0.2")
        projection = quote["portfolio_projection"]
        self.assertEqual(quote["station_count"], 1)
        self.assertEqual(projection["percentage_model"]["monthly_commission_before_cost"], "200.00")
        self.assertEqual(projection["percentage_model"]["annual_commission_before_cost"], "2400.00")

    def test_station_count_must_be_whole_and_bounded(self):
        for invalid_count in ("0", "-1", "1.5", "10001", "NaN", "Infinity", "nope"):
            with self.subTest(station_count=invalid_count), self.assertRaises(ValueError):
                preview_fuel_commercial_offer(station_count=invalid_count)

    def test_invalid_values_fail_closed(self):
        invalid = [
            dict(price_per_liter="0"),
            dict(monthly_turnover="-1"),
            dict(monthly_turnover="NaN"),
            dict(cent_per_liter="Infinity"),
            dict(percent_rate="101"),
            dict(psp_percent="-0.1"),
            dict(fee_basis="maybe"),
            dict(payment_fee_owner="customer"),
            dict(average_ticket="0"),
        ]
        for args in invalid:
            with self.subTest(args=args), self.assertRaises(ValueError):
                preview_fuel_commercial_offer(**args)

    def test_break_even_point_matches_quoted_models(self):
        q = preview_fuel_commercial_offer(
            monthly_turnover="100000", price_per_liter="2",
            percent_rate="0.5", cent_per_liter="1",
        )
        self.assertEqual(q["percentage_model"]["commission_before_cost"], "500.00")
        self.assertEqual(q["per_liter_model"]["commission_before_cost"], "500.00")
        self.assertEqual(Decimal(q["break_even_percentage_rate"]), Decimal("0.5000"))


if __name__ == "__main__":
    unittest.main()
