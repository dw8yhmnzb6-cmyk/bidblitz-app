from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
ADMIN_GRANTS_ROUTE = BACKEND_ROOT / "routes" / "admin_grants.py"


def _function_block(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def test_admin_eur_grant_uses_canonical_wallet_credit():
    source = ADMIN_GRANTS_ROUTE.read_text(encoding="utf-8")
    block = _function_block(
        source,
        "async def admin_grant_balance",
        "# ══════════════════════════════════════════════════════════════════════════════\n# ADMIN: Create Coupons",
    )

    assert "credit_wallet(" in block
    assert "TransactionType.ADMIN_CREDIT" in block
    assert 'source="admin_grant"' in block
    assert '"route": "admin_grants.balance"' in block
    assert 'idempotency_key=canonical_idempotency_key' in block
    assert '"$inc": {"balance"' not in block


def test_coupon_eur_redemption_is_canonical_and_deterministic():
    source = ADMIN_GRANTS_ROUTE.read_text(encoding="utf-8")
    block = _function_block(
        source,
        "async def redeem_coupon",
        "# ══════════════════════════════════════════════════════════════════════════════\n# ADMIN: Grant History",
    )

    assert "_claim_coupon_redemption(" in block
    assert "_claim_coupon_usage(" in block
    assert 'settlement_key = f"coupon_redemption:{coupon[\'coupon_id\']}:{user_id}"' in block
    assert "TransactionType.VOUCHER_REDEMPTION" in block
    assert 'idempotency_key=settlement_key' in block
    assert '"$inc": {"balance"' not in block


def test_coupon_usage_claim_is_atomic_against_concurrent_redemptions():
    source = ADMIN_GRANTS_ROUTE.read_text(encoding="utf-8")
    block = _function_block(
        source,
        "async def _claim_coupon_usage",
        "async def _apply_non_eur_coupon_reward",
    )

    assert '"used_count": {"$lt": coupon["max_uses"]}' in block
    assert '"used_by": {"$ne": user_id}' in block
    assert '"$inc": {"used_count": 1}' in block
    assert '"$addToSet": {"used_by": user_id}' in block
    assert '"coupon_claimed": True' in block


def test_coupon_redemption_record_has_deterministic_unique_identity():
    source = ADMIN_GRANTS_ROUTE.read_text(encoding="utf-8")
    block = _function_block(
        source,
        "async def _claim_coupon_redemption",
        "async def _claim_coupon_usage",
    )

    assert 'redemption_id = f"coupon:{coupon[\'coupon_id\']}:{user_id}"' in block
    assert '"_id": redemption_id' in block
    assert "db.coupon_redemptions.insert_one(doc)" in block
    assert "db.coupon_redemptions.find_one" in block
