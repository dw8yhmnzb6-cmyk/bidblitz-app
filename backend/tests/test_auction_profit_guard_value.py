from routes.auctions import (
    _credit_bucket_cents,
    _minimum_paid_credit_value_eur,
    _profit_guard_snapshot,
)


def test_credit_package_cash_values_are_exact():
    assert _credit_bucket_cents(5.00, 10) == 50
    assert _credit_bucket_cents(10.00, 25) == 40
    assert _credit_bucket_cents(17.50, 50) == 35
    assert _credit_bucket_cents(29.00, 100) == 29
    assert _credit_bucket_cents(62.50, 250) == 25
    assert _credit_bucket_cents(0.00, 5) == 0
    assert _minimum_paid_credit_value_eur() == 0.25


def test_profit_guard_uses_actual_paid_credit_revenue():
    auction = {
        "current_price": 49.03,
        "price_increment": 0.01,
        "product_cost_eur": 500.0,
        "shipping_cost_eur": 0.0,
        "other_costs_eur": 0.0,
        "target_net_profit_eur": 2000.0,
        "real_bid_revenue_eur": 2451.0,
        "bot_only": False,
    }
    guard = _profit_guard_snapshot(auction, 4902)
    assert guard["enabled"] is True
    assert guard["reached"] is True
    assert guard["net_profit_eur"] == 2000.03
    assert guard["real_bid_revenue_eur"] == 2451.0
    assert guard["estimated_real_bids_remaining"] == 0


def test_same_bid_count_does_not_fake_profit_when_credits_were_discounted_or_free():
    auction = {
        "current_price": 49.03,
        "price_increment": 0.01,
        "product_cost_eur": 500.0,
        "shipping_cost_eur": 0.0,
        "other_costs_eur": 0.0,
        "target_net_profit_eur": 2000.0,
        "real_bid_revenue_eur": 1225.50,
        "bot_only": False,
    }
    guard = _profit_guard_snapshot(auction, 4902)
    assert guard["reached"] is False
    assert guard["net_profit_eur"] == 774.53
    assert guard["missing_net_profit_eur"] == 1225.47
    assert guard["estimated_real_bids_remaining"] > 0
