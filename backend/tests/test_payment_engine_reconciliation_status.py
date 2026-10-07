import asyncio
from types import SimpleNamespace

from core import payment_engine


def _run(coro):
    return asyncio.run(coro)


def test_credit_wallet_preserves_reconciliation_required_status(monkeypatch):
    async def fake_credit_canonical_balance(**kwargs):
        return SimpleNamespace(
            success=False,
            transaction_id="recovery-tx",
            reference=kwargs["reference"],
            new_balance=None,
            error="Wallet mutation requires reconciliation",
            status="reconciliation_required",
        )

    monkeypatch.setattr(
        payment_engine,
        "credit_canonical_balance",
        fake_credit_canonical_balance,
    )

    result = _run(
        payment_engine.credit_wallet(
            user_id="user-1",
            amount=10.0,
            tx_type=payment_engine.TransactionType.ADMIN_CREDIT,
            description="Regression test",
            reference="ADMIN-RECOVERY-TEST",
            idempotency_key="admin-recovery-test",
        )
    )

    assert result.success is False
    assert result.status is payment_engine.TransactionStatus.RECONCILIATION_REQUIRED
    assert result.status.value == "reconciliation_required"
    assert result.error == "Wallet mutation requires reconciliation"
