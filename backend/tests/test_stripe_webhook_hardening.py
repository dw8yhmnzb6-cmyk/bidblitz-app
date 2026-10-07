from pathlib import Path


STRIPE_ROUTE = Path(__file__).resolve().parents[1] / "routes" / "stripe.py"


def test_only_one_stripe_webhook_route_is_registered_in_source():
    source = STRIPE_ROUTE.read_text(encoding="utf-8")
    assert source.count('@router.post("/webhook")') == 1


def test_stripe_checkout_uses_registered_webhook_url():
    source = STRIPE_ROUTE.read_text(encoding="utf-8")
    assert "/api/webhook/stripe" not in source
    assert "/api/stripe/webhook" in source


def test_stripe_wallet_webhook_uses_canonical_payment_engine():
    source = STRIPE_ROUTE.read_text(encoding="utf-8")
    assert "process_stripe_payment(" in source
    assert '"$inc": {"balance": result["amount"]}' not in source
