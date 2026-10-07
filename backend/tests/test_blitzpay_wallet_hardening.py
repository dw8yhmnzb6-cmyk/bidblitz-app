from pathlib import Path


ROUTE = Path(__file__).resolve().parents[1] / "routes" / "blitzpay.py"


def _block(source: str, start: str, end: str) -> str:
    a = source.index(start)
    return source[a:source.index(end, a)]


def test_nfc_pay_uses_canonical_idempotent_debit_and_marker():
    source = ROUTE.read_text(encoding="utf-8")
    block = _block(source, "async def nfc_payment", '@router.post("/merchant-charge")')
    assert "debit_wallet(" in block
    assert "TransactionType.PAYMENT" in block
    assert 'idempotency_key=f"blitzpay:{tx_id}:debit"' in block
    assert '"payment_markers": {"$ne": tx_id}' in source
    assert '"$inc": {"balance"' not in block
    assert "db.nfc_transactions.insert_one" not in block


def test_merchant_charge_debits_customer_credits_merchant_and_refunds_failure():
    source = ROUTE.read_text(encoding="utf-8")
    block = _block(source, "async def merchant_charge", '@router.get("/history")')
    assert "debit_wallet(" in block
    assert "credit_wallet(" in block
    assert "TransactionType.MERCHANT_PAYMENT" in block
    assert "TransactionType.MERCHANT_PAYMENT_RECEIVED" in block
    assert "TransactionType.REFUND" in block
    assert 'idempotency_key=f"blitzpay:{tx_id}:debit"' in block
    assert 'idempotency_key=f"blitzpay:{tx_id}:credit"' in block
    assert 'idempotency_key=f"blitzpay:{tx_id}:refund"' in block
    assert '"$inc": {"balance"' not in block
    assert "db.nfc_transactions.insert_one" not in block
