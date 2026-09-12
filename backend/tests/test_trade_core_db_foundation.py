import pytest

from trade_core.db.base import NAMING_CONVENTION, TradeBase
from trade_core.db.settings import (
    ASYNC_POSTGRES_SCHEME,
    TRADE_DATABASE_URL_ENV,
    TradeDatabaseConfigurationError,
    get_trade_database_url,
    normalize_trade_database_url,
)
import trade_core.db.session as trade_session


def test_trade_database_url_is_required(monkeypatch):
    monkeypatch.delenv(TRADE_DATABASE_URL_ENV, raising=False)

    with pytest.raises(TradeDatabaseConfigurationError):
        get_trade_database_url()


def test_postgresql_provider_urls_are_normalized_to_asyncpg():
    assert (
        normalize_trade_database_url("postgresql://user:pass@db/trade")
        == "postgresql+asyncpg://user:pass@db/trade"
    )
    assert (
        normalize_trade_database_url("postgres://user:pass@db/trade")
        == "postgresql+asyncpg://user:pass@db/trade"
    )


def test_asyncpg_url_is_preserved():
    url = "postgresql+asyncpg://user:pass@db/trade"
    assert normalize_trade_database_url(url) == url


def test_non_postgresql_database_is_rejected():
    with pytest.raises(TradeDatabaseConfigurationError):
        normalize_trade_database_url("sqlite:///trade.db")


def test_trade_base_uses_deterministic_constraint_names():
    assert TradeBase.metadata.naming_convention is not None
    assert dict(TradeBase.metadata.naming_convention) == NAMING_CONVENTION


def test_engine_is_lazy_and_not_created_at_import_time():
    assert trade_session._engine is None
    assert trade_session._session_factory is None


def test_explicit_async_scheme_constant():
    assert ASYNC_POSTGRES_SCHEME == "postgresql+asyncpg://"
