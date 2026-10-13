"""Offline tests for THE EYE's USGS feed, without network or MongoDB.

Extract only the pure feed functions and the guarded endpoint from the
existing provider module. Never call the external USGS service in tests.
"""
import ast
import asyncio
from datetime import datetime, timezone
import math
from pathlib import Path
import time
from typing import Any, Optional
import unittest


SOURCE = Path(__file__).resolve().parents[1] / "routes" / "the_eye_providers.py"
FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"


def example_feed():
    return {
        "type": "FeatureCollection",
        "features": [
            {"id": "usgs-valid", "geometry": {"coordinates": [20.1, 42.5, 4]}, "properties": {
                "mag": 3.5, "place": "Test location", "time": 1760000000000, "type": "earthquake",
            }},
            {"id": "invalid-latitude", "geometry": {"coordinates": [20, 200]}, "properties": {
                "mag": 4.0, "time": 1760000000000, "type": "earthquake",
            }},
            {"id": "not-an-earthquake", "geometry": {"coordinates": [20, 42]}, "properties": {
                "mag": 5.0, "time": 1760000000000, "type": "explosion",
            }},
            {"id": "too-small", "geometry": {"coordinates": [20, 42]}, "properties": {
                "mag": 1.5, "time": 1760000000000, "type": "earthquake",
            }},
        ],
    }


class FakeHTTPError(Exception):
    pass


class FakeHTTPException(Exception):
    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code


class FakeResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return example_feed()


class FakeClient:
    calls = 0
    fail = False

    def __init__(self, **kwargs):
        assert kwargs["follow_redirects"] is False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def get(self, url, headers):
        FakeClient.calls += 1
        assert url == FEED
        if FakeClient.fail:
            raise FakeHTTPError("service is down")
        return FakeResponse()


def load_isolated():
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    names = {"_valid_float", "_normalize_earthquakes", "live_earthquakes"}
    nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in names]
    assert len(nodes) == 3
    for node in nodes:
        node.decorator_list = []
    async def allow(*_args, **_kwargs):
        return None
    namespace = {
        "Any": Any, "Optional": Optional, "math": math, "datetime": datetime,
        "timezone": timezone, "asyncio": asyncio, "time": time,
        "httpx": type("HTTPX", (), {"AsyncClient": FakeClient, "HTTPError": FakeHTTPError}),
        "HTTPException": FakeHTTPException, "require_the_eye_access": allow,
        "USGS_EARTHQUAKE_FEED": FEED, "_earthquake_lock": asyncio.Lock(),
        "_EARTHQUAKE_TTL_SECONDS": 180, "_EARTHQUAKE_STALE_SECONDS": 1800,
        "_earthquake_cache": None, "_earthquake_cache_monotonic": 0.0,
    }
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(SOURCE), "exec"), namespace)
    return namespace


class USGSFeedTests(unittest.TestCase):
    def setUp(self):
        FakeClient.calls = 0
        FakeClient.fail = False
        self.ns = load_isolated()

    def test_normalization_excludes_invalid_and_non_earthquake_events(self):
        events = self.ns["_normalize_earthquakes"](example_feed())
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["id"], "usgs-valid")
        self.assertEqual(events[0]["lat"], 42.5)
        self.assertEqual(events[0]["magnitude"], 3.5)

    def test_malformed_geojson_fails_closed(self):
        with self.assertRaises(ValueError):
            self.ns["_normalize_earthquakes"]({"type": "bad", "features": []})

    def test_first_fetch_and_ttl_cache(self):
        first = asyncio.run(self.ns["live_earthquakes"](None))
        second = asyncio.run(self.ns["live_earthquakes"](None))
        self.assertEqual(first["status"], "live")
        self.assertEqual(second["status"], "cached")
        self.assertEqual(first["count"], 1)
        self.assertEqual(FakeClient.calls, 1)

    def test_stale_cache_is_explicitly_labeled(self):
        asyncio.run(self.ns["live_earthquakes"](None))
        self.ns["_earthquake_cache_monotonic"] = time.monotonic() - 200
        FakeClient.fail = True
        result = asyncio.run(self.ns["live_earthquakes"](None))
        self.assertEqual(result["status"], "stale")
        self.assertEqual(result["count"], 1)

    def test_outage_without_cache_returns_503(self):
        FakeClient.fail = True
        with self.assertRaises(FakeHTTPException) as caught:
            asyncio.run(self.ns["live_earthquakes"](None))
        self.assertEqual(caught.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
