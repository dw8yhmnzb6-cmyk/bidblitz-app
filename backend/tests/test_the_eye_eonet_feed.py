"""Offline regression tests for the existing THE EYE NASA EONET wildfire endpoint."""
import ast
import asyncio
from datetime import datetime, timezone
import math
from pathlib import Path
import time
from typing import Any, Optional
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "routes" / "the_eye_providers.py"
URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires&limit=100"


def sample_response():
    return {"events": [
        {"id": "EONET_valid", "title": "Test Wildfire", "closed": None,
         "categories": [{"id": "wildfires"}],
         "geometry": [
             {"date": "2026-10-11T12:00:00Z", "type": "Point", "coordinates": [-114.0, 42.0]},
             {"date": "2026-10-12T12:00:00Z", "type": "Point", "coordinates": [-113.0, 43.0]},
         ]},
        {"id": "EONET_poly", "title": "Polygon fire", "closed": None,
         "categories": [{"id": "wildfires"}],
         "geometry": [{"date": "2026-10-12T12:00:00Z", "type": "Polygon",
                       "coordinates": [[[-120.0, 35.0], [-119.0, 35.0],
                                        [-119.0, 36.0], [-120.0, 35.0]]]}]},
        {"id": "closed", "title": "Ended", "closed": "2026-10-12",
         "categories": [{"id": "wildfires"}],
         "geometry": [{"date": "2026-10-12T00:00:00Z", "type": "Point", "coordinates": [10, 20]}]},
        {"id": "invalid", "title": "Invalid coordinates", "closed": None,
         "categories": [{"id": "wildfires"}],
         "geometry": [{"date": "2026-10-12T00:00:00Z", "type": "Point", "coordinates": [200, 20]}]},
        {"id": "wrong-category", "title": "Flood", "closed": None,
         "categories": [{"id": "floods"}],
         "geometry": [{"date": "2026-10-12T00:00:00Z", "type": "Point", "coordinates": [10, 20]}]},
    ]}


class HTTPError(Exception):
    pass


class HTTPExceptionFake(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        super().__init__(detail)


class ResponseFake:
    def raise_for_status(self):
        pass

    def json(self):
        return sample_response()


class ClientFake:
    calls = 0
    fail = False

    def __init__(self, **kwargs):
        assert kwargs["follow_redirects"] is False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def get(self, url, headers):
        assert url == URL
        assert headers["Accept"] == "application/json"
        ClientFake.calls += 1
        if ClientFake.fail:
            raise HTTPError()
        return ResponseFake()


def load_isolated():
    syntax_tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    names = {"_valid_float", "_wildfire_coordinates", "_normalize_wildfires", "live_wildfires"}
    nodes = [node for node in syntax_tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
    assert len(nodes) == len(names)
    for node in nodes:
        node.decorator_list = []

    async def authorize(*args, **kwargs):
        return None

    namespace = {
        "Any": Any, "Optional": Optional, "math": math, "datetime": datetime,
        "timezone": timezone, "asyncio": asyncio, "time": time,
        "Request": object, "require_the_eye_access": authorize,
        "httpx": type("HTTPX", (), {"AsyncClient": ClientFake, "HTTPError": HTTPError}),
        "HTTPException": HTTPExceptionFake,
        "NASA_EONET_WILDFIRE_FEED": URL, "_WILDFIRE_TTL_SECONDS": 600,
        "_WILDFIRE_STALE_SECONDS": 3600, "_wildfire_lock": None,
        "_wildfire_cache": None, "_wildfire_cache_monotonic": 0.0,
    }
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(SOURCE), "exec"), namespace)
    return namespace


class EONETTests(unittest.TestCase):
    def setUp(self):
        ClientFake.calls = 0
        ClientFake.fail = False
        self.ns = load_isolated()

    def test_normalization_and_latest_observation(self):
        rows = self.ns["_normalize_wildfires"](sample_response())
        self.assertEqual(len(rows), 2)
        event = next(row for row in rows if row["id"] == "EONET_valid")
        self.assertEqual(event["lat"], 43.0)
        self.assertEqual(event["lng"], -113.0)
        self.assertFalse(event["approximate"])

    def test_polygon_position_is_labeled_approximate(self):
        rows = self.ns["_normalize_wildfires"](sample_response())
        polygon = next(row for row in rows if row["id"] == "EONET_poly")
        self.assertTrue(polygon["approximate"])
        self.assertTrue(-121 <= polygon["lng"] <= -118)

    def test_malformed_payload_fails_closed(self):
        with self.assertRaises(ValueError):
            self.ns["_normalize_wildfires"]({"events": "invalid"})

    def test_cache_and_refresh(self):
        first = asyncio.run(self.ns["live_wildfires"](None))
        second = asyncio.run(self.ns["live_wildfires"](None))
        self.assertEqual(first["status"], "live")
        self.assertEqual(first["count"], 2)
        self.assertEqual(second["status"], "cached")
        self.assertEqual(ClientFake.calls, 1)

    def test_upstream_outage_with_stale_cache(self):
        asyncio.run(self.ns["live_wildfires"](None))
        self.ns["_wildfire_cache_monotonic"] -= 800
        ClientFake.fail = True
        response = asyncio.run(self.ns["live_wildfires"](None))
        self.assertEqual(response["status"], "stale")

    def test_outage_without_cache_is_503(self):
        ClientFake.fail = True
        with self.assertRaises(HTTPExceptionFake) as ctx:
            asyncio.run(self.ns["live_wildfires"](None))
        self.assertEqual(ctx.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
