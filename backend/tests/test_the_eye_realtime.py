"""Offline runtime tests for the production The Eye realtime modules.

Only the authentication/database boundary is substituted. WebSocket framing,
JSON encoding, role/scope filtering and the ASGI endpoint use production code.
"""
import asyncio
import importlib
import json
import sys
import types
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def modules(monkeypatch):
    # Isolated packages avoid importing the full application or opening MongoDB.
    # monkeypatch restores every prior module when this test finishes.
    for package_name in ("core", "routes"):
        package = types.ModuleType(package_name)
        package.__path__ = [str(BACKEND / package_name)]
        monkeypatch.setitem(sys.modules, package_name, package)
    security = types.ModuleType("core.security")
    security.get_current_user = AsyncMock()
    security.get_current_user_from_token = AsyncMock(
        return_value={"id": "admin-test", "role": "admin"}
    )
    monkeypatch.setitem(sys.modules, "core.security", security)
    for name in (
        "core.the_eye_access", "core.the_eye_data_safety",
        "core.the_eye_live", "routes.the_eye_ws",
    ):
        monkeypatch.setitem(sys.modules, name, None)
        monkeypatch.delitem(sys.modules, name)
    access = importlib.import_module("core.the_eye_access")
    live = importlib.import_module("core.the_eye_live")
    ws = importlib.import_module("routes.the_eye_ws")
    return types.SimpleNamespace(access=access, live=live, ws=ws, security=security)


class RecordingSocket:
    def __init__(self, *, stalled=False, broken=False):
        self.messages = []
        self.closed = []
        self.stalled = stalled
        self.broken = broken
        self.delivered = asyncio.Event()

    async def accept(self):
        pass

    async def send_json(self, payload):
        if self.stalled:
            await asyncio.Event().wait()
        if self.broken:
            raise RuntimeError("connection gone")
        self.messages.append(json.loads(json.dumps(payload, allow_nan=False)))
        self.delivered.set()

    async def close(self, code=1000):
        self.closed.append(code)


def test_timestamps_and_secrets_arrive_over_real_websocket(modules):
    async def scenario():
        sent = []
        incoming = asyncio.Queue()
        await incoming.put({"type": "websocket.connect"})

        async def send(message):
            sent.append(message)

        socket = WebSocket(
            {"type": "websocket", "path": "/api/the-eye/ws", "headers": []},
            incoming.get, send,
        )
        hub = modules.live.TheEyeLiveHub()
        access = modules.access.TheEyeAccess({"id": "admin"}, "admin")
        await hub.connect(socket, access)
        now = datetime(2026, 10, 4, 1, 0, tzinfo=timezone.utc)
        payload = {
            "device_id": "DEV-test", "last_seen_at": now,
            "metrics": {"recorded_at": now, "access_token": "test-secret"},
        }
        await hub.broadcast("device.heartbeat", payload)
        events = [json.loads(m["text"]) for m in sent if m["type"] == "websocket.send"]
        assert len(events) == 1
        assert events[0]["payload"]["last_seen_at"] == "2026-10-04T01:00:00+00:00"
        assert events[0]["payload"]["metrics"]["access_token"] == "[REDACTED]"
        assert "test-secret" not in json.dumps(events)
        assert payload["metrics"]["access_token"] == "test-secret"
        assert socket in hub._clients

    asyncio.run(scenario())


@pytest.mark.parametrize("role,scope,payload,expected", [
    ("admin", {}, {}, True),
    ("super_admin", {}, {}, True),
    ("project_admin", {"project_ids": ["p1"]}, {"project_id": "p1"}, True),
    ("project_admin", {"project_ids": ["p1"]}, {"project_id": "p2"}, False),
    ("site_manager", {"site_ids": ["s1"]}, {"site_id": "s1"}, True),
    ("site_manager", {"site_ids": ["s1"]}, {"site_id": "s2"}, False),
    ("customer", {"customer_ids": ["c1"]}, {"customer_id": "c1"}, True),
    ("customer", {"customer_ids": ["c1"]}, {"customer_id": "c2"}, False),
    ("partner", {"tenant_ids": ["t1"]}, {"tenant_id": "t1"}, True),
    ("partner", {"tenant_ids": ["t1"]}, {"tenant_id": "t2"}, False),
    ("partner", {"tenant_ids": ["t1"], "site_ids": ["s1"]},
     {"tenant_id": "t2", "site_id": "s1"}, False),
    ("site_manager", {}, {"site_id": "s1"}, False),
    ("site_manager", {"site_ids": ["s1"]}, {}, False),
    ("public", {"site_ids": ["s1"]}, {"site_id": "s1"}, False),
    ("invalid_role", {"site_ids": ["s1"]}, {"site_id": "s1"}, False),
])
def test_fanout_keeps_scopes_isolated(modules, role, scope, payload, expected):
    async def scenario():
        hub = modules.live.TheEyeLiveHub()
        socket = RecordingSocket()
        access = modules.access.TheEyeAccess(
            {"id": "viewer", "the_eye_scope": scope}, role
        )
        await hub.connect(socket, access)
        await hub.broadcast("device.heartbeat", payload)
        assert bool(socket.messages) is expected
    asyncio.run(scenario())


@pytest.mark.parametrize("event_type,assigned_to,site,expected", [
    ("ticket.updated", "tech-1", "s1", True),
    ("work_order.updated", "tech@example.test", "s1", True),
    ("action.updated", "other-tech", "s1", False),
    ("ticket.updated", "tech-1", "s2", False),
    ("ticket.updated", None, "s1", False),
    ("device.heartbeat", "tech-1", "s1", False),
])
def test_technician_only_receives_assigned_work(
    modules, event_type, assigned_to, site, expected,
):
    async def scenario():
        hub = modules.live.TheEyeLiveHub()
        socket = RecordingSocket()
        access = modules.access.TheEyeAccess(
            {"id": "tech-1", "email": "tech@example.test", "site_ids": ["s1"]},
            "technician",
        )
        await hub.connect(socket, access)
        await hub.broadcast(event_type, {"site_id": site, "assigned_to": assigned_to})
        assert bool(socket.messages) is expected
    asyncio.run(scenario())


def test_slow_and_broken_clients_do_not_block_healthy_clients(modules):
    async def scenario():
        hub = modules.live.TheEyeLiveHub(send_timeout_seconds=0.05)
        slow, broken, healthy = (
            RecordingSocket(stalled=True), RecordingSocket(broken=True), RecordingSocket()
        )
        access = modules.access.TheEyeAccess({"id": "admin"}, "admin")
        for socket in (slow, broken, healthy):
            await hub.connect(socket, access)
        broadcast = asyncio.create_task(hub.broadcast("device.heartbeat", {"device_id": "d1"}))
        try:
            await asyncio.wait_for(healthy.delivered.wait(), timeout=0.5)
            await asyncio.wait_for(broadcast, timeout=0.5)
            assert len(healthy.messages) == 1
            assert healthy in hub._clients
            assert slow not in hub._clients and broken not in hub._clients
            assert slow.closed == [1013] and broken.closed == [1013]
            await hub.broadcast("device.heartbeat", {"device_id": "d2"})
            assert len(healthy.messages) == 2
        finally:
            if not broadcast.done():
                broadcast.cancel()
                await asyncio.gather(broadcast, return_exceptions=True)
    asyncio.run(scenario())


def make_app(modules):
    app = FastAPI()
    app.include_router(modules.ws.router)

    @app.post("/test/event")
    async def emit():
        await modules.live.the_eye_live_hub.broadcast(
            "device.heartbeat",
            {"device_id": "d1", "last_seen_at": datetime.now(timezone.utc)},
        )
        return {"ok": True}
    return app


def test_authenticated_asgi_handshake_ping_and_event(modules):
    with TestClient(make_app(modules)) as client:
        with client.websocket_connect(
            "/api/the-eye/ws", headers={"cookie": "access_token=test-only"}
        ) as socket:
            assert socket.receive_json()["type"] == "connected"
            socket.send_json({"type": "ping"})
            assert socket.receive_json() == {"type": "pong"}
            assert client.post("/test/event").status_code == 200
            event = socket.receive_json()
            assert event["type"] == "device.heartbeat"
            assert isinstance(event["payload"]["last_seen_at"], str)
    assert not modules.live.the_eye_live_hub._clients


@pytest.mark.parametrize("cookie,role,error,code", [
    (None, "admin", None, 4401),
    ("access_token=test-only", "admin", HTTPException(401, "expired"), 4401),
    ("access_token=test-only", "public", None, 4403),
    ("access_token=test-only", "unknown", None, 4403),
])
def test_unauthorized_sessions_never_subscribe(modules, cookie, role, error, code):
    modules.security.get_current_user_from_token.return_value = {"id": "u1", "role": role}
    modules.security.get_current_user_from_token.side_effect = error
    with TestClient(make_app(modules)) as client:
        with client.websocket_connect(
            "/api/the-eye/ws", headers={"cookie": cookie} if cookie else {},
        ) as socket:
            assert socket.receive_json()["type"] == "error"
            with pytest.raises(WebSocketDisconnect) as exc:
                socket.receive_json()
            assert exc.value.code == code
    assert not modules.live.the_eye_live_hub._clients


@pytest.mark.parametrize("message", ["[]", "null", "not-json"])
def test_malformed_messages_close_cleanly(modules, message):
    with TestClient(make_app(modules)) as client:
        with client.websocket_connect(
            "/api/the-eye/ws", headers={"cookie": "access_token=test-only"}
        ) as socket:
            assert socket.receive_json()["type"] == "connected"
            socket.send_text(message)
            with pytest.raises(WebSocketDisconnect) as exc:
                socket.receive_json()
            assert exc.value.code == 1003
    assert not modules.live.the_eye_live_hub._clients


def test_failed_initial_ack_cleans_up_subscription(modules):
    async def scenario():
        socket = RecordingSocket(broken=True)
        socket.cookies = {"access_token": "test-only"}
        with pytest.raises(RuntimeError, match="connection gone"):
            await modules.ws.the_eye_websocket(socket)
        assert not modules.live.the_eye_live_hub._clients
    asyncio.run(scenario())
