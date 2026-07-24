import requests


BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"


def login_session():
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!"},
    )
    assert response.status_code == 200, response.text
    return session


def ensure_match(session):
    matches = session.get(f"{BASE_URL}/api/dating/matches").json().get("matches", [])
    if matches:
        return matches[0]["match_id"]
    session.post(f"{BASE_URL}/api/dating/like", json={"profile_id": "DAT-SEED-LINA", "super_like": False})
    matches = session.get(f"{BASE_URL}/api/dating/matches").json().get("matches", [])
    assert matches, "Kein Match verfügbar"
    return matches[0]["match_id"]


def test_chat_messages_returns_chat_safety_summary():
    session = login_session()
    match_id = ensure_match(session)
    response = session.get(f"{BASE_URL}/api/dating/matches/{match_id}/messages")
    assert response.status_code == 200, response.text
    data = response.json()
    assert "chat_safety_summary" in data
    assert "level" in data["chat_safety_summary"]


def test_chat_safety_refresh_endpoint():
    session = login_session()
    match_id = ensure_match(session)
    response = session.post(
        f"{BASE_URL}/api/dating/matches/{match_id}/chat-safety",
        json={"match_id": match_id, "force": True},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["ok"] is True
    assert data["match_id"] == match_id
    assert "chat_safety_summary" in data


def test_high_risk_message_blocked():
    session = login_session()
    match_id = ensure_match(session)
    response = session.post(
        f"{BASE_URL}/api/dating/matches/{match_id}/messages",
        json={"text": "Schick mir sofort Geld per PayPal Friends und sende deinen SMS Code auf Telegram."},
    )
    assert response.status_code == 400, response.text
    assert "riskant" in response.text or "Nachricht blockiert" in response.text


def test_normal_message_still_works():
    session = login_session()
    match_id = ensure_match(session)
    response = session.post(
        f"{BASE_URL}/api/dating/matches/{match_id}/messages",
        json={"text": "Hi, wie war dein Sonntag bisher?"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["ok"] is True
    assert "chat_safety_preflight" in data
    assert data["chat_safety_preflight"]["safe_to_send"] is True
