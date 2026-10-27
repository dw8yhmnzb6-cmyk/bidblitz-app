"""Safety contracts for parcel booking and survey wallet rewards."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_parcel_booking_uses_canonical_wallet_and_is_provider_gated():
    parcels = read("backend/routes/parcels.py")

    assert "from core.payment_engine import debit_wallet, credit_wallet, TransactionType" in parcels
    assert "_require_parcel_booking_provider()" in parcels
    assert "if not TEST_MODE:" in parcels
    assert 'idempotency_key=f"parcel-book:{client_key}"' in parcels
    assert 'idempotency_key=f"parcel-cashback:{parcel_id}"' in parcels
    assert '"$inc": {"balance": -price}' not in parcels
    assert "db.transactions.insert_one" not in parcels


def test_parcel_frontend_sends_retry_safe_key_and_shows_preview_state():
    page = read("frontend/src/pages/ParcelPage.jsx")

    assert "bookingAttemptKeyRef = useRef(null)" in page
    assert '"Idempotency-Key": idempotencyKey' in page
    assert "idempotency_key: idempotencyKey" in page
    assert 'data-testid="parcel-provider-preview"' in page
    assert "disabled={!bookingEnabled || !rName || !rCity || booking}" in page


def test_survey_rewards_do_not_mint_production_wallet_value():
    surveys = read("backend/routes/surveys.py")

    assert "from core.payment_engine import credit_wallet, TransactionType" in surveys
    assert "if not TEST_MODE:" in surveys
    assert 'idempotency_key=f"survey-reward:{user_id}:{req.survey_id}"' in surveys
    assert '"$inc": {"balance": survey["reward_eur"]}' not in surveys
    assert '"reward_actions_enabled": bool(TEST_MODE)' in surveys
