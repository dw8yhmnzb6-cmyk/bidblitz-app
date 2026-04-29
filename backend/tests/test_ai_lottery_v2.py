"""
Backend tests for BidBlitz V2 - AI features (chatbot, content gen, recommendations)
and Lottery prize_pool improvement.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-preview-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

KUNDE_EMAIL = "kunde@bidblitz.com"
KUNDE_PASSWORD = "Kunde2026!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": KUNDE_EMAIL, "password": KUNDE_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    assert "access_token" in s.cookies
    return s


# ─── Lottery ─────────────────────────────────────────────────────────────────

def test_lottery_current_has_prize_pool(session):
    r = session.get(f"{API}/lottery/current", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "prize_pool" in data, f"Missing prize_pool: {list(data.keys())}"
    pp = data["prize_pool"]
    for tier in ("grand", "big", "small", "mini"):
        assert tier in pp, f"Missing tier {tier}"
        cfg = pp[tier]
        assert "items" in cfg and isinstance(cfg["items"], list) and len(cfg["items"]) >= 1
        assert "label_de" in cfg and "label_en" in cfg
        assert "count_per_draw" in cfg
        assert "blz" in cfg
        sample = cfg["items"][0]
        for key in ("name", "value_eur", "image", "description"):
            assert key in sample, f"Tier {tier} item missing {key}"
        assert isinstance(sample["value_eur"], (int, float))
        assert sample["image"].startswith("http")


def test_lottery_grand_has_iphone_or_macbook(session):
    r = session.get(f"{API}/lottery/current", timeout=15)
    data = r.json()
    grand_names = " ".join(i["name"] for i in data["prize_pool"]["grand"]["items"]).lower()
    assert "iphone" in grand_names or "macbook" in grand_names, (
        f"Expected iPhone/MacBook in grand tier, got: {grand_names}"
    )


# ─── AI Chatbot ──────────────────────────────────────────────────────────────

def test_ai_chat_requires_auth():
    r = requests.post(f"{API}/ai/chat", json={"message": "Hallo"}, timeout=15)
    assert r.status_code in (401, 403), r.status_code


def test_ai_chat_basic_german(session):
    r = session.post(f"{API}/ai/chat", json={"message": "Hallo, was ist BidBlitz?", "session_id": None}, timeout=45)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "response" in data and isinstance(data["response"], str) and len(data["response"]) > 5
    assert "session_id" in data and data["session_id"].startswith("chat_")
    return data["session_id"]


def test_ai_chat_multi_turn(session):
    r1 = session.post(f"{API}/ai/chat", json={"message": "Wie funktioniert die Lotterie?"}, timeout=45)
    assert r1.status_code == 200
    sid = r1.json()["session_id"]
    time.sleep(1)
    r2 = session.post(f"{API}/ai/chat", json={"message": "Und welche Preise kann ich gewinnen?", "session_id": sid}, timeout=45)
    assert r2.status_code == 200
    assert r2.json()["session_id"] == sid


def test_ai_chat_history_list(session):
    r = session.get(f"{API}/ai/chat/history", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "sessions" in data and isinstance(data["sessions"], list)


def test_ai_chat_history_specific(session):
    # create session
    r = session.post(f"{API}/ai/chat", json={"message": "Test"}, timeout=45)
    sid = r.json()["session_id"]
    r2 = session.get(f"{API}/ai/chat/history", params={"session_id": sid}, timeout=15)
    assert r2.status_code == 200
    body = r2.json()
    assert body.get("session_id") == sid
    assert "messages" in body and len(body["messages"]) >= 2


def test_ai_chat_delete_session(session):
    r = session.post(f"{API}/ai/chat", json={"message": "ToDelete"}, timeout=45)
    sid = r.json()["session_id"]
    rd = session.delete(f"{API}/ai/chat/{sid}", timeout=15)
    assert rd.status_code == 200
    assert rd.json().get("ok") is True


# ─── AI Content Generator ────────────────────────────────────────────────────

def test_ai_content_requires_auth():
    r = requests.post(f"{API}/ai/content/generate", json={
        "content_type": "ad_headline", "business_name": "X", "tone": "playful", "language": "de"
    }, timeout=15)
    assert r.status_code in (401, 403)


def test_ai_content_generate_german_headline(session):
    payload = {
        "content_type": "ad_headline",
        "business_name": "Pizza Roma Berlin",
        "category": "Italienisches Restaurant",
        "keywords": ["frische Zutaten", "Steinofen"],
        "tone": "playful",
        "language": "de",
    }
    r = session.post(f"{API}/ai/content/generate", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "text" in data and isinstance(data["text"], str) and len(data["text"]) > 0
    assert "variations" in data and len(data["variations"]) == 3


def test_ai_content_invalid_type(session):
    r = session.post(f"{API}/ai/content/generate", json={
        "content_type": "invalid", "business_name": "X"
    }, timeout=15)
    assert r.status_code in (400, 422)


# ─── Smart Recommendations ───────────────────────────────────────────────────

def test_ai_recommendations_requires_auth():
    r = requests.get(f"{API}/ai/recommendations", timeout=15)
    assert r.status_code in (401, 403)


def test_ai_recommendations_returns_items(session):
    r = session.get(f"{API}/ai/recommendations", params={"limit": 4}, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data and isinstance(data["items"], list) and len(data["items"]) >= 1
    assert "generated_at" in data
    item = data["items"][0]
    for key in ("title", "description", "category", "reason", "cta"):
        assert key in item, f"Missing key {key}"
    valid_categories = {
        "lottery", "auction", "restaurant", "hotel", "taxi", "telemedizin",
        "handwerker", "freelancer", "streaming", "mining", "premium", "ad_campaign", "general"
    }
    # at least 1 item should be from valid set
    assert any(i["category"] in valid_categories for i in data["items"]), \
        f"No valid category in: {[i['category'] for i in data['items']]}"
