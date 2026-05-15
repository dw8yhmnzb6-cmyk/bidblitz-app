"""
Backend test for AI Chatbot (gpt-5.2 + RAG) — iteration 45.

Verifies:
 1. KB retrieval (data.bidblitz_kb.search) returns expected first-hit doc.
 2. POST /api/chatbot/send (auth) injects RAG context — reply contains
    KB-specific facts (numbers/keywords) for auctions, wallet, referral.
 3. POST /api/chatbot/send (no auth) returns 401.
 4. GET /api/chatbot/history (auth) returns messages array.
 5. DELETE /api/chatbot/history (auth) clears messages.
 6. Regression: GET /api/geo/cities?q=ber still 200.
"""
import os
import sys
import pytest
import requests

# Make backend importable for KB unit tests
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-portal.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


# ── Fixtures ──────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def anon_session():
    return requests.Session()


# ── 1. KB retrieval unit tests ────────────────────────────────────────
class TestKBRetrieval:
    def test_search_auktion_returns_auctions_basics(self):
        from data.bidblitz_kb import search
        hits = search("Auktion", top_k=3)
        assert hits, "no hits for query 'Auktion'"
        assert hits[0]["id"] == "auctions-basics", f"first hit was {hits[0]['id']}"

    def test_search_guthaben_aufladen_returns_wallet(self):
        from data.bidblitz_kb import search
        hits = search("Guthaben aufladen", top_k=3)
        assert hits, "no hits for 'Guthaben aufladen'"
        assert hits[0]["id"] == "wallet", f"first hit was {hits[0]['id']}"

    def test_build_context_block_has_facts(self):
        from data.bidblitz_kb import build_context_block
        block = build_context_block("Penny-Auktion", top_k=3)
        assert "0,50" in block and "0,01" in block and "10 Sek" in block, \
            "context block missing expected auction facts"


# ── 2. /api/chatbot/send auth + RAG injection ─────────────────────────
class TestChatbotRAG:
    def test_send_unauthorized(self, anon_session):
        r = anon_session.post(
            f"{BASE_URL}/api/chatbot/send",
            json={"message": "Hallo", "language": "de"},
            timeout=30,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"

    def _ask(self, sess, msg):
        # Clear history first to avoid the known history-replay bug (store=False kwarg)
        sess.delete(f"{BASE_URL}/api/chatbot/history", timeout=15)
        r = sess.post(
            f"{BASE_URL}/api/chatbot/send",
            json={"message": msg, "language": "de"},
            timeout=120,
        )
        assert r.status_code == 200, f"chat send failed {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "response" in data and isinstance(data["response"], str) and data["response"], \
            "no response text"
        return data["response"]

    def test_history_replay_bug_reproduces_500(self, auth_session):
        """Reproduces known bug: when chat_history >= 1 user msg exists,
        the next /send raises 500 because chat.send_message() does NOT
        accept store=False kwarg in current emergentintegrations version."""
        # ensure at least one prior user message exists
        auth_session.delete(f"{BASE_URL}/api/chatbot/history", timeout=15)
        r1 = auth_session.post(
            f"{BASE_URL}/api/chatbot/send",
            json={"message": "Hallo", "language": "de"},
            timeout=120,
        )
        assert r1.status_code == 200, f"first send must succeed, got {r1.status_code}"
        # second send triggers history replay loop -> currently 500
        r2 = auth_session.post(
            f"{BASE_URL}/api/chatbot/send",
            json={"message": "Was kann BidBlitz?", "language": "de"},
            timeout=120,
        )
        if r2.status_code == 500 and "store" in r2.text:
            pytest.xfail(f"KNOWN BUG: history-replay 500 — {r2.text[:200]}")
        # if main agent fixed it, ensure it's now 200
        assert r2.status_code == 200, f"unexpected status {r2.status_code}: {r2.text[:200]}"

    def test_rag_penny_auction_facts(self, auth_session):
        text = self._ask(auth_session, "Wie funktionieren die Penny-Auktionen?")
        markers = ["0,50", "0,01", "10 Sek", "Bot"]
        hits = [m for m in markers if m.lower() in text.lower()]
        assert len(hits) >= 2, f"expected >=2 KB markers, got {hits}; text={text[:400]}"

    def test_rag_wallet_500_eur_limit(self, auth_session):
        text = self._ask(auth_session, "Was kostet ein Wallet-Topup maximal?")
        assert "500" in text, f"expected '500' in answer, got: {text[:400]}"

    def test_rag_referral_bonus_5eur_10pct(self, auth_session):
        text = self._ask(auth_session, "Wie funktioniert der Referral-Bonus?")
        assert "5" in text and "%" in text and "10" in text, \
            f"expected '5 €' and '10%' in referral answer, got: {text[:400]}"


# ── 3. history GET / DELETE ──────────────────────────────────────────
class TestChatbotHistory:
    def test_get_history_returns_messages(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/chatbot/history", timeout=30)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert "messages" in data and isinstance(data["messages"], list)
        assert "total" in data

    def test_delete_history_clears(self, auth_session):
        r = auth_session.delete(f"{BASE_URL}/api/chatbot/history", timeout=30)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert data.get("ok") is True
        assert "deleted" in data and isinstance(data["deleted"], int)
        # Verify history is now empty
        r2 = auth_session.get(f"{BASE_URL}/api/chatbot/history", timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("total", -1) == 0


# ── 4. Regression: geo/cities ────────────────────────────────────────
class TestRegression:
    def test_geo_cities_ber(self, anon_session):
        r = anon_session.get(f"{BASE_URL}/api/geo/cities", params={"q": "ber"}, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        # response is either list or dict with results — accept both
        results = data if isinstance(data, list) else data.get("results", [])
        names = " ".join((d.get("name", "") if isinstance(d, dict) else "") for d in results).lower()
        assert "berlin" in names, f"Berlin not in results: {names[:200]}"
