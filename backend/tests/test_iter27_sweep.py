"""Iteration 27 backend regression sweep:
- WS Auth Hardening (/api/chat/ws/{room_id}) — 4401/4403
- /api/auth/ws-token (5 min JWT)
- /api/voice/parse (single + multi-step + 401)
- /api/loyalty/levels and /api/loyalty/history
- /api/superapp-tips/presets (with + without service_type)
- /api/group/{id}/join idempotency + my-groups enrichment
"""
import os
import asyncio
import json
import uuid
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://taxi-uber-style.preview.emergentagent.com").rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASS = "BidBlitz2026!"
KUNDE_EMAIL = "kunde@bidblitz.com"
KUNDE_PASS = "Kunde2026!"


# ---------- shared fixtures ----------
def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def kunde_session():
    return _login(KUNDE_EMAIL, KUNDE_PASS)


@pytest.fixture(scope="module")
def admin_session():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def kunde_ws_token(kunde_session):
    r = kunde_session.get(f"{BASE_URL}/api/auth/ws-token", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_ws_token(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/auth/ws-token", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- /api/auth/ws-token ----------
class TestWsToken:
    def test_ws_token_authed(self, kunde_session):
        r = kunde_session.get(f"{BASE_URL}/api/auth/ws-token", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data.get("expires_in") == 300

    def test_ws_token_unauth(self):
        r = requests.get(f"{BASE_URL}/api/auth/ws-token", timeout=15)
        assert r.status_code == 401

    def test_ws_token_jwt_exp_is_300s(self, kunde_session):
        """iter28: explicit ttl=300 — decoded JWT exp - now ≈ 300s"""
        import jwt as _jwt
        import time
        r = kunde_session.get(f"{BASE_URL}/api/auth/ws-token", timeout=15)
        assert r.status_code == 200
        token = r.json()["token"]
        # decode without verifying (we don't have the secret here)
        payload = _jwt.decode(token, options={"verify_signature": False})
        assert "exp" in payload
        delta = payload["exp"] - int(time.time())
        # Accept 290..310 to absorb network latency
        assert 290 <= delta <= 310, f"expected ~300s, got {delta}"


# ---------- /api/chat/ws/{room_id} security ----------
async def _ws_close_code(url: str) -> int:
    """Connect to WS and return the close code (or 1000 if accepted cleanly)."""
    try:
        async with websockets.connect(url, open_timeout=10, close_timeout=5) as ws:
            # If accept-then-close was used, recv() will raise ConnectionClosed with the code
            try:
                await asyncio.wait_for(ws.recv(), timeout=5)
            except websockets.exceptions.ConnectionClosed as e:
                return e.code
            except asyncio.TimeoutError:
                pass
            # If we got here, server accepted and is alive
            await ws.close()
            return 1000
    except websockets.exceptions.InvalidStatus as e:  # pre-handshake reject (HTTP)
        return e.response.status_code
    except websockets.exceptions.ConnectionClosed as e:
        return e.code


class TestWsAuthHardening:
    def test_ws_no_token_4401(self):
        room = f"itertest-{uuid.uuid4().hex[:8]}"
        code = asyncio.run(_ws_close_code(f"{WS_BASE}/api/chat/ws/{room}"))
        assert code == 4401, f"expected 4401, got {code}"

    def test_ws_invalid_token_4401(self):
        room = f"itertest-{uuid.uuid4().hex[:8]}"
        code = asyncio.run(_ws_close_code(f"{WS_BASE}/api/chat/ws/{room}?token=not.a.jwt"))
        assert code == 4401, f"expected 4401, got {code}"

    def test_ws_valid_token_non_member_4403(self, kunde_ws_token):
        # Random room id where kunde is not a member -> should be 4403
        room = f"nonmember-{uuid.uuid4().hex[:10]}"
        code = asyncio.run(_ws_close_code(f"{WS_BASE}/api/chat/ws/{room}?token={kunde_ws_token}"))
        assert code == 4403, f"expected 4403 not_a_member, got {code}"

    def test_ws_admin_bypass(self, admin_ws_token):
        # Admin can join any random room (bypass)
        room = f"adminbypass-{uuid.uuid4().hex[:10]}"
        async def _try():
            url = f"{WS_BASE}/api/chat/ws/{room}?token={admin_ws_token}"
            async with websockets.connect(url, open_timeout=10, close_timeout=5) as ws:
                # First frame should be history
                first = await asyncio.wait_for(ws.recv(), timeout=5)
                payload = json.loads(first)
                assert payload.get("type") == "history"
                await ws.close()
                return True
        assert asyncio.run(_try()) is True


# ---------- /api/voice/parse ----------
class TestVoiceParse:
    def test_voice_parse_unauth(self):
        r = requests.post(
            f"{BASE_URL}/api/voice/parse",
            json={"transcript": "Buche ein Taxi"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_voice_parse_simple_book_taxi(self, kunde_session):
        r = kunde_session.post(
            f"{BASE_URL}/api/voice/parse",
            json={"transcript": "Buche ein Taxi"},
            timeout=45,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "intents" in data and isinstance(data["intents"], list)
        assert "raw" in data
        actions = [i.get("action") for i in data["intents"]]
        assert "book_taxi" in actions, f"expected book_taxi, got {actions} (raw={data.get('raw')})"

    def test_voice_parse_multi_step(self, kunde_session):
        r = kunde_session.post(
            f"{BASE_URL}/api/voice/parse",
            json={"transcript": "Bestelle Pizza Margherita von Marios und teile mit anna@example.com"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        intents = data.get("intents", [])
        actions = [i.get("action") for i in intents]
        # Per spec: must contain search_food then open_split_pay
        assert len(intents) >= 2, f"expected >=2 intents, got {actions} (raw={data.get('raw')})"
        assert "search_food" in actions and "open_split_pay" in actions, f"got {actions}"
        # Order: search_food before open_split_pay
        assert actions.index("search_food") < actions.index("open_split_pay")


# ---------- /api/loyalty ----------
class TestLoyalty:
    def test_loyalty_levels(self):
        # iter28: prefix renamed to /api/loyalty-superapp
        r = requests.get(f"{BASE_URL}/api/loyalty-superapp/levels", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "levels" in data
        levels = data["levels"]
        assert isinstance(levels, list) and len(levels) == 4
        names = [lv["name"] for lv in levels]
        assert names == ["Bronze", "Silver", "Gold", "Platinum"], f"got {names}"
        for lv in levels:
            for k in ("level", "name", "points", "discount", "perks"):
                assert k in lv, f"missing {k} in {lv}"
            assert isinstance(lv["perks"], list)

    def test_loyalty_history_authed(self, kunde_session):
        r = kunde_session.get(f"{BASE_URL}/api/loyalty-superapp/history?limit=10", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "history" in data and isinstance(data["history"], list)
        assert "count" in data and isinstance(data["count"], int)
        assert data["count"] == len(data["history"])
        assert len(data["history"]) <= 10

    def test_loyalty_history_unauth(self):
        r = requests.get(f"{BASE_URL}/api/loyalty-superapp/history", timeout=15)
        assert r.status_code == 401


# ---------- /api/superapp-tips/presets ----------
class TestSuperAppTipsPresets:
    def test_presets_with_taxi(self):
        r = requests.get(f"{BASE_URL}/api/superapp-tips/presets?service_type=taxi", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("service_type") == "taxi"
        assert data.get("currency") == "EUR"
        assert data.get("amounts") == [1.0, 2.0, 3.0, 5.0] or data.get("amounts") == [1, 2, 3, 5]

    def test_presets_without_service_type(self):
        r = requests.get(f"{BASE_URL}/api/superapp-tips/presets", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("currency") == "EUR"
        presets = data.get("presets", {})
        for k in ("taxi", "food", "scooter"):
            assert k in presets, f"missing {k} in presets"
            assert isinstance(presets[k], list) and len(presets[k]) > 0

    def test_presets_unknown_service_type(self):
        r = requests.get(f"{BASE_URL}/api/superapp-tips/presets?service_type=unicorn", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("currency") == "EUR"
        # Falls back to default amounts
        assert isinstance(data.get("amounts"), list) and len(data["amounts"]) > 0


# ---------- /api/group: idempotent join + my-groups enrichment ----------
class TestGroupOrdersIdempotency:
    def test_join_idempotent_and_my_groups_enriched(self, kunde_session, admin_session):
        # admin creates a group inviting kunde
        kunde_me = kunde_session.get(f"{BASE_URL}/api/auth/me", timeout=15).json()
        kunde_email = kunde_me.get("email") or KUNDE_EMAIL

        r = admin_session.post(
            f"{BASE_URL}/api/group/create",
            json={
                "service_type": "food",
                "participants": [kunde_email],
                "details": {"restaurant_id": "TEST_iter27"},
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        group_id = r.json()["group_id"]

        # First join by kunde
        r1 = kunde_session.post(f"{BASE_URL}/api/group/{group_id}/join", timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("success") is True

        # Second join by same kunde -> 200 already_joined:true (was 400)
        r2 = kunde_session.post(f"{BASE_URL}/api/group/{group_id}/join", timeout=15)
        assert r2.status_code == 200, f"expected idempotent 200, got {r2.status_code} {r2.text}"
        d2 = r2.json()
        assert d2.get("already_joined") is True

        # my-groups must include this group with my_email + my_user_id
        rg = kunde_session.get(f"{BASE_URL}/api/group/my-groups", timeout=15)
        assert rg.status_code == 200, rg.text
        groups = rg.json().get("groups", [])
        match = next((g for g in groups if g.get("group_id") == group_id), None)
        assert match is not None, f"created group not returned in my-groups for kunde"
        assert match.get("my_email") == kunde_email
        assert match.get("my_user_id"), "my_user_id missing in enrichment"
