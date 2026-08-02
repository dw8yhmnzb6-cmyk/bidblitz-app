from datetime import datetime, timezone

from core.money import basis_points_fee, from_minor, to_minor
from services.merchant_settlement import build_period, estimate_next_payout_date


def test_money_utils_use_minor_units_precisely():
    assert to_minor(12.50) == 1250
    assert to_minor("1000.00") == 100000
    assert from_minor(1250) == 12.5


def test_basis_points_fee_rounding():
    assert basis_points_fee(10000, 150) == 150
    assert basis_points_fee(999, 50) == 5


def test_build_period_daily_and_weekly():
    anchor = datetime(2026, 8, 2, 13, 0, tzinfo=timezone.utc)
    daily_start, daily_end = build_period("daily", anchor=anchor)
    assert daily_start.isoformat().startswith("2026-08-02T00:00:00")
    assert (daily_end - daily_start).days == 1
    weekly_start, weekly_end = build_period("weekly", anchor=anchor)
    assert (weekly_end - weekly_start).days == 7


def test_next_payout_date_returns_iso_string():
    assert len(estimate_next_payout_date("weekly")) == 10
    assert len(estimate_next_payout_date("monthly")) == 10