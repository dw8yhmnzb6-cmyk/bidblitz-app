from datetime import datetime, timezone, timedelta
import pytest
from core.analytics_revenue import revenue_by_project, period_bounds

NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)

def row(project="power", status="captured", amount=1000, fee=120, event="e1", time=NOW, currency="EUR", verified=True):
    return dict(project=project, status=status, amount_minor=amount,
        platform_fee_minor=fee, transaction_event_id=event, occurred_at=time,
        currency=currency, verified=verified)

def test_projects_and_refunds_are_separate():
    result = revenue_by_project([
        row(), row(), row(status="refunded", amount=300, fee=36, event="r1"),
        row(project="fuel", amount=5000, fee=250, event="f1"),
        row(project="power", verified=False, event="browser"),
    ], "today", NOW + timedelta(seconds=1))
    assert result == [
        dict(project="fuel", currency="EUR", gross_minor=5000, refund_minor=0,
             net_volume_minor=5000, platform_fee_minor=250, payment_count=1),
        dict(project="power", currency="EUR", gross_minor=1000, refund_minor=300,
             net_volume_minor=700, platform_fee_minor=84, payment_count=1),
    ]

def test_no_currency_mixing():
    result = revenue_by_project([row(), row(currency="USD", event="u1")], "today", NOW + timedelta(seconds=1))
    assert len(result) == 2

@pytest.mark.parametrize("period", ["today", "yesterday", "week", "month", "year"])
def test_supported_periods(period):
    start, end = period_bounds(period, NOW)
    assert start < end

def test_yesterday_excludes_today():
    assert revenue_by_project([row()], "yesterday", NOW) == []

@pytest.mark.parametrize("field,value", [("amount_minor", -1), ("platform_fee_minor", 2000), ("occurred_at", "today"), ("transaction_event_id", "")])
def test_bad_verified_ledger_rejected(field, value):
    with pytest.raises(ValueError):
        revenue_by_project([{**row(), field: value}], "today", NOW + timedelta(seconds=1))
