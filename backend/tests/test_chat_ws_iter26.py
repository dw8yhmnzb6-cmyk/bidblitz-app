"""
Iteration 26 — Live-Chat WebSocket /api/chat/ws/{room_id} + REST helpers.
Tests:
  - WS history bootstrap on connect
  - WS persist + broadcast (single + two-client room)
  - GET /api/chat/messages/{room_id} returns persisted messages
  - POST /api/chat/quick-reply with valid + invalid reply_type
"""
import asyncio
import json
import os
import uuid

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
# Public URL is https://; convert to wss://
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


@pytest.fixture
def room_id():
    return f"itertest-{uuid.uuid4().hex[:10]}"


# --- WebSocket tests ---

@pytest.mark.asyncio
async def test_ws_connect_history_first(room_id):
    url = f"{WS_BASE}/api/chat/ws/{room_id}"
    async with websockets.connect(url) as ws:
        first = await asyncio.wait_for(ws.recv(), timeout=10)
        data = json.loads(first)
        assert data["type"] == "history"
        assert isinstance(data["messages"], list)
        # New room → empty history
        assert data["messages"] == []


@pytest.mark.asyncio
async def test_ws_send_persist_broadcast(room_id):
    url = f"{WS_BASE}/api/chat/ws/{room_id}"
    async with websockets.connect(url) as ws:
        # consume history
        await asyncio.wait_for(ws.recv(), timeout=10)
        payload = {
            "sender_id": "u1",
            "sender_name": "Alice",
            "message": "Hallo Welt",
        }
        await ws.send(json.dumps(payload))
        echo = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        assert echo["sender_id"] == "u1"
        assert echo["sender_name"] == "Alice"
        assert echo["message"] == "Hallo Welt"
        assert echo["chat_id"] == room_id
        assert echo["ride_id"] == room_id
        assert "_id" not in echo
        assert "created_at" in echo

    # GET REST → message persisted
    r = requests.get(f"{BASE_URL}/api/chat/messages/{room_id}", timeout=10)
    assert r.status_code == 200
    body = r.json()
    msgs = body["messages"]
    assert len(msgs) >= 1
    assert any(m["message"] == "Hallo Welt" and m["sender_id"] == "u1" for m in msgs)


@pytest.mark.asyncio
async def test_ws_two_clients_broadcast(room_id):
    url = f"{WS_BASE}/api/chat/ws/{room_id}"
    async with websockets.connect(url) as a, websockets.connect(url) as b:
        # consume both history frames
        await asyncio.wait_for(a.recv(), timeout=10)
        await asyncio.wait_for(b.recv(), timeout=10)

        await a.send(json.dumps({
            "sender_id": "driver-1",
            "sender_name": "Driver",
            "message": "Bin in 2 Min da",
        }))

        # Both clients should receive the broadcast
        msg_a = json.loads(await asyncio.wait_for(a.recv(), timeout=10))
        msg_b = json.loads(await asyncio.wait_for(b.recv(), timeout=10))
        assert msg_a["message"] == "Bin in 2 Min da"
        assert msg_b["message"] == "Bin in 2 Min da"
        assert msg_a["sender_id"] == "driver-1" == msg_b["sender_id"]


# --- REST quick-reply ---

def test_quick_reply_arriving():
    rid = f"qr-{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{BASE_URL}/api/chat/quick-reply",
        params={"ride_id": rid, "reply_type": "arriving"},
        timeout=10,
    )
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["message"]["message"] == "Ich bin in 2 Minuten da"
    assert d["message"]["sender_id"] == "system"

    # And it must be persisted
    g = requests.get(f"{BASE_URL}/api/chat/messages/{rid}", timeout=10)
    assert g.status_code == 200
    assert any(m["message"] == "Ich bin in 2 Minuten da" for m in g.json()["messages"])


def test_quick_reply_waiting_and_thank_you():
    rid = f"qr-{uuid.uuid4().hex[:8]}"
    for rt, expected in [("waiting", "Ich warte draußen"), ("thank_you", "Vielen Dank!")]:
        r = requests.post(
            f"{BASE_URL}/api/chat/quick-reply",
            params={"ride_id": rid, "reply_type": rt},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        assert r.json()["message"]["message"] == expected


def test_quick_reply_unknown_type():
    rid = f"qr-{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{BASE_URL}/api/chat/quick-reply",
        params={"ride_id": rid, "reply_type": "nope"},
        timeout=10,
    )
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is False
    assert d.get("error") == "unknown_reply_type"
