import pytest
from pydantic import ValidationError

from schemas.models import TopUpRequest


def test_direct_topup_stays_blocked_in_production_even_if_test_mode_is_enabled(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("TEST_MODE", "true")

    with pytest.raises(ValidationError, match="Direct wallet top-up is disabled"):
        TopUpRequest(amount=25)


def test_direct_topup_requires_test_mode(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("TEST_MODE", "false")

    with pytest.raises(ValidationError, match="Direct wallet top-up is disabled"):
        TopUpRequest(amount=25)


def test_direct_topup_allowed_only_in_non_production_test_mode(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("TEST_MODE", "true")

    req = TopUpRequest(amount=25)
    assert req.amount == 25
