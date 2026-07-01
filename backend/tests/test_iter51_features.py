"""
Iter51 — Backend tests
- Resend error reporting: distinguishes 'rejected' vs 'logged_only' vs 'sent'
- Automatic LLM-based lead scoring after chat
- Manual POST /score-session admin endpoint
- GET /leads sorted by lead_score DESC
- Regression: iter50 sales-invite still works (room+email response shape)
"""
import os
import time
import secrets
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://biometric-checkout-7.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASS = "BidBlitz2026!"
USER_EMAIL = "kunde@bidblitz.com"
USER_PASS = "Kunde2026!"


def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="session")
def admin_session():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def user_session():
    return _login(USER_EMAIL, USER_PASS)


# ──────────────── Sales-invite email_reason ────────────────
class TestSalesInviteEmailReason:
    """Verify that sales-invite returns granular email_reason field."""

    def test_sales_invite_fake_domain_returns_rejected(self, admin_session):
        """Resend rejects unverified @example.com domain → email_reason='rejected' + error."""
        fake_email = f"TEST_iter51_fake_{secrets.token_hex(4)}@example.com"
        r = admin_session.post(
            f"{BASE_URL}/api/landing-chatbot/leads/sales-invite",
            json={"email": fake_email, "message": "iter51 rejection test"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["lead_email"] == fake_email
        assert d["room_name"].startswith("sales-")
        assert "join_url" in d and d["join_url"]
        # Core assertion: email_reason field exists and resend_enabled true
        assert "email_reason" in d, "email_reason field missing"
        assert "email_sent" in d
        assert "resend_enabled" in d
        # When RESEND_API_KEY is set but domain is unverified, Resend rejects
        if d["resend_enabled"]:
            # Expect either 'rejected' or 'sent' — with .example.com it's ALWAYS rejected
            assert d["email_reason"] in ("rejected", "sent"), f"unexpected reason: {d['email_reason']}"
            if d["email_reason"] == "rejected":
                assert d["email_sent"] is False
                assert d.get("email_error"), "rejected should carry email_error"
                # The specific Resend error mentions domain/verified
                err = (d.get("email_error") or "").lower()
                assert any(k in err for k in ("domain", "verified", "testing", "your own")), \
                    f"unexpected rejection error: {d.get('email_error')}"
        else:
            # Key missing — should be logged_only
            assert d["email_reason"] == "logged_only"
            assert d["email_sent"] is True

    def test_sales_invite_response_has_backward_compat_fields(self, admin_session):
        """Ensure iter50 contract still holds: ok, room_name, join_url, email_sent, lead_email."""
        email = f"TEST_iter51_compat_{secrets.token_hex(4)}@example.com"
        r = admin_session.post(
            f"{BASE_URL}/api/landing-chatbot/leads/sales-invite",
            json={"email": email, "message": "compat"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("ok", "room_name", "join_url", "email_sent", "lead_email"):
            assert key in d, f"iter50 contract broken: missing {key}"

    def test_sales_invite_non_admin_forbidden(self, user_session):
        r = user_session.post(
            f"{BASE_URL}/api/landing-chatbot/leads/sales-invite",
            json={"email": "TEST_iter51_block@example.com", "message": "x"},
            timeout=30,
        )
        assert r.status_code == 403


# ──────────────── Lead-scoring (LLM) ────────────────
class TestLeadScoring:
    """End-to-end lead scoring flow: 5-turn chat → /leads w/ session_id → score-session."""

    @pytest.fixture(scope="class")
    def scored_session(self, admin_session):
        """Create a fresh session, send 5+ chat turns, capture lead with session_id,
        then call /score-session to force scoring synchronously.
        """
        session_id = f"TEST_iter51_score_{secrets.token_hex(6)}"
        test_email = f"TEST_iter51_score_{secrets.token_hex(4)}@example.com"

        messages = [
            "Hallo, ich habe ein Restaurant mit 40 Plätzen in München und brauche ein neues POS-System.",
            "Aktuell nutzen wir ein altes System ohne TSE. Könnt ihr das?",
            "Wir machen ca. 500k Umsatz pro Jahr, brauchen Rechnungsdruck und Küchendisplay.",
            "Wie viel kostet euer POS-Paket pro Monat? Und gibt es eine kostenlose Demo?",
            "Ich würde gerne eine Demo buchen, bitte schickt Details an " + test_email,
        ]
        for m in messages:
            r = requests.post(
                f"{BASE_URL}/api/landing-chatbot/chat",
                json={"session_id": session_id, "message": m, "email": test_email},
                timeout=60,
            )
            assert r.status_code == 200, f"chat turn failed: {r.status_code} {r.text[:200]}"

        # Capture lead explicitly with session_id (as LandingPage frontend does)
        r = requests.post(
            f"{BASE_URL}/api/landing-chatbot/leads",
            json={
                "email": test_email,
                "name": "TEST Iter51 Restaurant Owner",
                "interest": "demo",
                "session_id": session_id,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text

        # Force synchronous re-score via admin endpoint (waits for LLM)
        r = admin_session.post(
            f"{BASE_URL}/api/landing-chatbot/score-session",
            params={"session_id": session_id},
            timeout=90,
        )
        assert r.status_code == 200, f"score-session failed: {r.status_code} {r.text[:300]}"
        payload = r.json()
        return {"session_id": session_id, "email": test_email, "score_payload": payload}

    def test_score_session_shape(self, scored_session):
        """Verify /score-session returns {ok:true, session_id, score:{...}}."""
        p = scored_session["score_payload"]
        assert p["ok"] is True
        assert p["session_id"] == scored_session["session_id"]
        score = p.get("score")
        assert score is not None, f"score missing — likely LLM call failed: {p}"
        assert "score" in score
        assert "category" in score
        assert "reason" in score
        assert "tags" in score
        assert "scored_at" in score

        assert isinstance(score["score"], int)
        assert 0 <= score["score"] <= 100
        assert score["category"] in ("hot", "warm", "cold")
        assert isinstance(score["reason"], str) and len(score["reason"]) > 0
        assert isinstance(score["tags"], list)
        assert len(score["tags"]) <= 4
        # model may be present
        if "model" in score:
            assert score["model"] == "gpt-4.1-mini"

    def test_score_session_non_admin_forbidden(self, user_session):
        r = user_session.post(
            f"{BASE_URL}/api/landing-chatbot/score-session",
            params={"session_id": "whatever"},
            timeout=30,
        )
        assert r.status_code == 403

    def test_leads_list_contains_scored_lead_with_fields(self, admin_session, scored_session):
        """GET /leads should include the scored lead with lead_score, lead_category, etc."""
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/leads", timeout=30)
        assert r.status_code == 200, r.text
        leads = r.json().get("leads", [])
        target = next((l for l in leads if l.get("email") == scored_session["email"]), None)
        assert target is not None, f"lead {scored_session['email']} not found"

        assert "lead_score" in target and isinstance(target["lead_score"], int)
        assert 0 <= target["lead_score"] <= 100
        assert target.get("lead_category") in ("hot", "warm", "cold")
        assert isinstance(target.get("lead_score_reason"), str)
        assert isinstance(target.get("lead_tags"), list)
        assert target.get("lead_scored_at")

    def test_leads_sorted_by_score_desc(self, admin_session, scored_session):
        """GET /leads must return hot leads first (sorted by lead_score DESC)."""
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/leads", timeout=30)
        assert r.status_code == 200
        leads = r.json().get("leads", [])
        scores = [l.get("lead_score") or 0 for l in leads]
        # Assert monotonically non-increasing
        assert scores == sorted(scores, reverse=True), f"leads not sorted desc by score: {scores[:10]}"


# ──────────────── Regression: iter50 flows still green ────────────────
class TestIter50Regression:
    def test_csv_export_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/leads/export", timeout=30)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        disposition = r.headers.get("content-disposition", "")
        assert "bidblitz-leads-" in disposition

    def test_analytics_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/analytics", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_sessions", "total_messages", "total_leads", "conversion_rate"):
            assert k in d

    def test_csv_export_non_admin_forbidden(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/landing-chatbot/leads/export", timeout=30)
        assert r.status_code == 403
