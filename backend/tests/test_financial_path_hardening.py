from pathlib import Path

from routes.p2p_transfer import transfer_reference


BACKEND_ROOT = Path(__file__).resolve().parents[1]
P2P_ROUTE = BACKEND_ROOT / "routes" / "p2p_transfer.py"
REFERRAL_ROUTE = BACKEND_ROOT / "routes" / "referral.py"


def _function_block(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def test_p2p_client_idempotency_reference_is_stable():
    first = transfer_reference("sender", "recipient", 12.34, "checkout-123")
    second = transfer_reference("sender", "recipient", 12.34, "checkout-123")
    changed_amount = transfer_reference("sender", "recipient", 12.35, "checkout-123")
    changed_recipient = transfer_reference("sender", "recipient-2", 12.34, "checkout-123")

    assert first == second
    assert first.startswith("P2P-")
    assert first != changed_amount
    assert first != changed_recipient


def test_p2p_transfer_uses_canonical_engine_not_direct_balance_writes():
    source = P2P_ROUTE.read_text(encoding="utf-8")
    block = _function_block(
        source,
        "async def instant_transfer",
        "# ══════════════════════════════════════════════════════════════════════════════\n# QR CODE TRANSFER",
    )

    assert "transfer_between_wallets(" in block
    assert "TransactionType.TRANSFER" in block
    assert "Idempotency-Key" in block
    assert '"$inc": {"balance"' not in block
    assert "db.transactions.insert_many" not in block


def test_referral_reward_uses_canonical_idempotent_wallet_credits():
    source = REFERRAL_ROUTE.read_text(encoding="utf-8")
    helper = _function_block(
        source,
        "async def _grant_referral_wallet_reward",
        '@router.get("/check-rewards")',
    )
    block = _function_block(
        source,
        "async def check_and_grant_rewards",
        '@router.get("/leaderboard")',
    )

    assert "credit_wallet(" in helper
    assert "TransactionType.REWARD" in helper
    assert "idempotency_key" in helper
    assert "_grant_referral_wallet_reward(" in block
    assert '"$inc": {"balance"' not in block
    assert "db.transactions.insert_one" not in block
    assert '"reward_given": False' in block
    assert "marked.modified_count == 1" in block
