from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
ADMIN_WALLET = BACKEND_ROOT / "routes" / "admin_wallet.py"
WALLET = BACKEND_ROOT / "routes" / "wallet.py"


def test_admin_wallet_blz_mutations_are_idempotent_and_atomic():
    source = ADMIN_WALLET.read_text(encoding="utf-8")

    assert "_claim_blz_operation(" in source
    assert "payment_idempotency" in source
    assert '"idempotency_key": idempotency_key' in source
    assert '"balance_blz": {"$gte": amount}' in source
    assert "modified_count != 1" in source
    assert "Idempotency-Key" in source


def test_admin_wallet_eur_and_blz_use_distinct_idempotency_scopes():
    source = ADMIN_WALLET.read_text(encoding="utf-8")

    assert 'f"{idem_key}:blz"' in source
    assert "idempotency_key=idem_key" in source


def test_admin_send_requires_idempotency_and_passes_it_to_canonical_credit():
    source = WALLET.read_text(encoding="utf-8")
    block = source[source.index("async def admin_send_money"):source.index("# ═", source.index("async def admin_send_money") + 1)]

    assert "Idempotency-Key erforderlich" in block
    assert "idempotency_key=idempotency_key" in block
    assert '"type": "admin_gift"' in block
