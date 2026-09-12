"""Configuration helpers for the Trade BidBlitz PostgreSQL database."""

from __future__ import annotations

import os


TRADE_DATABASE_URL_ENV = "TRADE_DATABASE_URL"
ASYNC_POSTGRES_SCHEME = "postgresql+asyncpg://"


class TradeDatabaseConfigurationError(RuntimeError):
    """Raised when the trade-core database configuration is missing or unsafe."""


def normalize_trade_database_url(raw_url: str) -> str:
    """Return a SQLAlchemy asyncpg URL and reject non-PostgreSQL databases.

    The trading core deliberately accepts only PostgreSQL.  Common provider URLs
    using ``postgres://`` or ``postgresql://`` are upgraded to the explicit
    asyncpg dialect so callers cannot accidentally run the economic ledger on a
    different database engine.
    """

    url = (raw_url or "").strip()
    if not url:
        raise TradeDatabaseConfigurationError(
            f"{TRADE_DATABASE_URL_ENV} is required for the Trade BidBlitz core"
        )

    if url.startswith(ASYNC_POSTGRES_SCHEME):
        return url
    if url.startswith("postgresql://"):
        return ASYNC_POSTGRES_SCHEME + url[len("postgresql://") :]
    if url.startswith("postgres://"):
        return ASYNC_POSTGRES_SCHEME + url[len("postgres://") :]

    scheme = url.split(":", 1)[0] if ":" in url else "missing"
    raise TradeDatabaseConfigurationError(
        "Trade BidBlitz requires PostgreSQL via asyncpg; "
        f"unsupported database scheme: {scheme!r}"
    )


def get_trade_database_url() -> str:
    """Read and normalize the trade-core database URL at call time."""

    return normalize_trade_database_url(os.getenv(TRADE_DATABASE_URL_ENV, ""))
