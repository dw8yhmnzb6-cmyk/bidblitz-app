"""Lazy async SQLAlchemy engine/session management for Trade BidBlitz."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .settings import get_trade_database_url


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_trade_engine() -> AsyncEngine:
    """Create the async engine on first use, never at module import time."""

    global _engine
    if _engine is None:
        _engine = create_async_engine(
            get_trade_database_url(),
            pool_pre_ping=True,
            pool_recycle=300,
        )
    return _engine


def get_trade_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the singleton async session factory for the trading core."""

    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_trade_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_factory


async def get_trade_session() -> AsyncIterator[AsyncSession]:
    """Yield a transaction-neutral session for FastAPI/service dependencies.

    Callers must commit explicitly.  Exceptions trigger a rollback so failed
    economic operations cannot leave an open transaction behind.
    """

    factory = get_trade_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def dispose_trade_engine() -> None:
    """Dispose the engine and clear cached objects, mainly for shutdown/tests."""

    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
