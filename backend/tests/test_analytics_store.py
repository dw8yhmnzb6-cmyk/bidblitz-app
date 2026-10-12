from datetime import datetime, timezone
from unittest.mock import AsyncMock
import pytest
from core.analytics_store import persist_validated_event

@pytest.mark.asyncio
async def test_store_writes_only_validated_dimensions():
    collection, counters = AsyncMock(), AsyncMock()
    now = datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
    payload = {"project": "trade", "event": "page_view", "path": "/pricing", "timestamp": now.isoformat()}
    result = await persist_validated_event(collection, counters, payload, "trade", now)
    assert result == {"ok": True, "project": "trade"}
    row = collection.insert_one.await_args.args[0]
    assert "ip" not in row and "user_id" not in row and "session_id" not in row
    counter_key = counters.update_one.await_args.args[0]
    assert counter_key == {"day": "2026-10-12", "project": "trade", "event": "page_view"}

@pytest.mark.asyncio
async def test_invalid_project_has_no_database_side_effect():
    collection, counters = AsyncMock(), AsyncMock()
    now = datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
    payload = {"project": "trade", "event": "page_view", "path": "/", "timestamp": now.isoformat()}
    with pytest.raises(ValueError):
        await persist_validated_event(collection, counters, payload, "eyes", now)
    collection.insert_one.assert_not_awaited()
    counters.update_one.assert_not_awaited()
