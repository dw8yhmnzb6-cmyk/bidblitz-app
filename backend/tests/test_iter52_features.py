"""
Iter52 backend tests:
(a) Slack/Discord webhooks (core/webhooks) — graceful no-op when env not set
(b) Score-history collection (immutable timeline) + score-history endpoints
(c) Lead-funnel tracking (5 stages) + /analytics/funnel + /funnel/track
(d) LiveKit Egress start/stop/list with mock fallback
Regression: iter51 sales-invite email_reason, LLM lead-scoring, /leads sorting
"""
import os
import sys
import secrets
import asyncio
import requests
import pytest

# Ensure /app/backend is on sys.path for core.* imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://taxi-streaming.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASS = "BidBlitz2026!"
USER_EMAIL = "kunde@bidblitz.com"
USER_PASS = "Kunde2026!"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="session")
def admin_session():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def user_session():
    return _login(USER_EMAIL, USER_PASS)


# ──────────── (a) Webhook helpers ─────────────
class TestWebhookHelpers:
    def test_webhook_functions_graceful_without_env(self):
        """core/webhooks send_slack/send_discord return False gracefully when env missing."""
        from core.webhooks import send_slack_webhook, send_discord_webhook, notify_hot_lead
        # Temporarily ensure not set
        old_s = os.environ.pop("SLACK_WEBHOOK_URL", None)
        old_d = os.environ.pop("DISCORD_WEBHOOK_URL", None)
        try:
            async def _run():
                s_ok = await send_slack_webhook("test msg")
                d_ok = await send_discord_webhook("test msg")
                notify = await notify_hot_lead(
                    "x@y.com", 95, "hot", "reason", ["t1"], "sess_iter52_unit"
                )
                return s_ok, d_ok, notify
            s_ok, d_ok, notify = asyncio.run(_run())
            assert s_ok is False
            assert d_ok is False
            assert notify == {"slack": False, "discord": False}
        finally:
            if old_s is not None:
                os.environ["SLACK_WEBHOOK_URL"] = old_s
            if old_d is not None:
                os.environ["DISCORD_WEBHOOK_URL"] = old_d


# ──────────── (b+c) E2E funnel + score history ─────────────
@pytest.fixture(scope="module")
def e2e_flow(admin_session):
    """Full flow: 5-turn chat → /leads → /score-session → expect funnel events + history."""
    session_id = f"TEST_iter52_{secrets.token_hex(6)}"
    email = f"TEST_iter52_{secrets.token_hex(4)}@example.com"

    msgs = [
        "Hallo, ich habe ein Restaurant mit 50 Plätzen in Berlin und brauche ein neues POS-System.",
        "Aktuell nutzen wir ein altes System ohne TSE. Habt ihr eine DSFinV-K konforme Lösung?",
        "500k Umsatz/Jahr. Wir brauchen Rechnung, Kassenbon, Küchendisplay.",
        "Wie viel kostet euer POS-Paket? Ich würde gerne eine Demo buchen bitte.",
        f"Bitte schickt Demo-Details an {email}, ich bin stark interessiert.",
    ]
    for m in msgs:
        r = requests.post(
            f"{BASE_URL}/api/landing-chatbot/chat",
            json={"session_id": session_id, "message": m, "email": email},
            timeout=60,
        )
        assert r.status_code == 200, r.text

    # /leads POST (with session_id)
    r = requests.post(
        f"{BASE_URL}/api/landing-chatbot/leads",
        json={"email": email, "name": "TEST iter52", "interest": "demo", "session_id": session_id},
        timeout=30,
    )
    assert r.status_code == 200, r.text

    # Admin force-score (sync)
    r = admin_session.post(
        f"{BASE_URL}/api/landing-chatbot/score-session",
        params={"session_id": session_id},
        timeout=120,
    )
    assert r.status_code == 200, r.text
    score_payload = r.json()

    # Sales invite
    r = admin_session.post(
        f"{BASE_URL}/api/landing-chatbot/leads/sales-invite",
        json={"email": email, "message": "iter52 test"},
        timeout=30,
    )
    assert r.status_code == 200, r.text

    # Public sales_call_accepted tracking
    r = requests.post(
        f"{BASE_URL}/api/landing-chatbot/funnel/track",
        params={"stage": "sales_call_accepted", "session_id": session_id, "email": email},
        timeout=30,
    )
    assert r.status_code == 200, r.text

    return {"session_id": session_id, "email": email, "score": score_payload}


class TestScoreHistory:
    def test_score_history_by_session(self, admin_session, e2e_flow):
        sid = e2e_flow["session_id"]
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/score-history/{sid}", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_id"] == sid
        assert d["count"] >= 1
        assert isinstance(d["history"], list)
        entry = d["history"][0]
        assert "score" in entry
        assert "category" in entry
        assert "scored_at" in entry

    def test_score_history_by_email(self, admin_session, e2e_flow):
        r = admin_session.get(
            f"{BASE_URL}/api/landing-chatbot/leads/score-history-by-email/{e2e_flow['email']}",
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == e2e_flow["email"]
        assert d["count"] >= 1
        # Sorted ascending by scored_at
        times = [h.get("scored_at") for h in d["history"]]
        assert times == sorted(times)

    def test_score_history_appends_on_rescore(self, admin_session, e2e_flow):
        """Second /score-session call should append a NEW history entry (not upsert)."""
        sid = e2e_flow["session_id"]
        before = admin_session.get(
            f"{BASE_URL}/api/landing-chatbot/score-history/{sid}", timeout=30
        ).json()["count"]
        r = admin_session.post(
            f"{BASE_URL}/api/landing-chatbot/score-session",
            params={"session_id": sid},
            timeout=120,
        )
        assert r.status_code == 200
        after = admin_session.get(
            f"{BASE_URL}/api/landing-chatbot/score-history/{sid}", timeout=30
        ).json()["count"]
        assert after == before + 1, f"history count didn't increment: {before} → {after}"

    def test_score_history_non_admin_forbidden(self, user_session, e2e_flow):
        r = user_session.get(
            f"{BASE_URL}/api/landing-chatbot/score-history/{e2e_flow['session_id']}",
            timeout=30,
        )
        assert r.status_code == 403


class TestFunnelAnalytics:
    def test_funnel_analytics_shape(self, admin_session, e2e_flow):
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/analytics/funnel", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "funnel" in d and isinstance(d["funnel"], list)
        stages_expected = ["chat_started", "email_requested", "email_captured",
                           "sales_call_sent", "sales_call_accepted"]
        actual = [s["stage"] for s in d["funnel"]]
        assert actual == stages_expected
        for s in d["funnel"]:
            assert "count" in s
            assert "from_top_pct" in s
            assert "from_prev_pct" in s
        assert "hot_leads_total" in d
        assert "hot_alerts_sent" in d
        assert isinstance(d["hot_leads_total"], int)

    def test_funnel_includes_our_session(self, admin_session, e2e_flow):
        """After e2e flow all 5 stages should be >=1 (chat_started, email_captured, sales_call_sent, sales_call_accepted)."""
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/analytics/funnel", timeout=30)
        d = r.json()
        counts = {s["stage"]: s["count"] for s in d["funnel"]}
        # Required stages from our e2e
        assert counts["chat_started"] >= 1
        assert counts["email_captured"] >= 1
        assert counts["sales_call_sent"] >= 1
        assert counts["sales_call_accepted"] >= 1

    def test_funnel_track_invalid_stage(self):
        r = requests.post(
            f"{BASE_URL}/api/landing-chatbot/funnel/track",
            params={"stage": "not_real", "session_id": "x"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_funnel_analytics_non_admin(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/landing-chatbot/analytics/funnel", timeout=30)
        assert r.status_code == 403


class TestHotLeadMarker:
    def test_hot_lead_has_alert_metadata(self, admin_session, e2e_flow):
        """If score >=80, the lead row should have hot_alert_sent_at + hot_alert_channels."""
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/leads", timeout=30)
        assert r.status_code == 200
        leads = r.json().get("leads", [])
        target = next((l for l in leads if l.get("email") == e2e_flow["email"]), None)
        assert target is not None
        score = target.get("lead_score") or 0
        if score >= 80:
            assert target.get("hot_alert_sent_at"), "hot_alert_sent_at missing for >=80 score"
            assert "hot_alert_channels" in target
            assert isinstance(target["hot_alert_channels"], list)
        else:
            pytest.skip(f"Lead score {score} < 80 — hot-alert metadata not expected")


# ──────────── (d) LiveKit Egress ─────────────
class TestLiveKitEgress:
    def test_egress_start_returns_mock_status(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/livekit/rooms/test-iter52-room/egress/start",
            json={"room_name": "test-iter52-room", "output_type": "mp4", "layout": "grid"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "egress_id" in d
        assert d["status"] in ("mock", "started")
        if d["status"] == "mock":
            assert d.get("note") or d.get("error")
        return d["egress_id"]

    def test_egress_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/livekit/egress", timeout=30)
        assert r.status_code == 200
        d = r.json()
        # Accept dict shape or list shape
        items = d.get("egress") if isinstance(d, dict) else d
        assert items is not None

    def test_egress_stop(self, admin_session):
        start = admin_session.post(
            f"{BASE_URL}/api/livekit/rooms/test-iter52-stop/egress/start",
            json={"room_name": "test-iter52-stop", "output_type": "mp4", "layout": "grid"},
            timeout=30,
        )
        assert start.status_code == 200
        egress_id = start.json()["egress_id"]
        r = admin_session.post(f"{BASE_URL}/api/livekit/egress/{egress_id}/stop", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_egress_stop_non_owner_non_admin_forbidden(self, admin_session, user_session):
        """A regular user who didn't create the egress should get 403 on stop."""
        start = admin_session.post(
            f"{BASE_URL}/api/livekit/rooms/test-iter52-perm/egress/start",
            json={"room_name": "test-iter52-perm", "output_type": "mp4", "layout": "grid"},
            timeout=30,
        )
        egress_id = start.json()["egress_id"]
        r = user_session.post(f"{BASE_URL}/api/livekit/egress/{egress_id}/stop", timeout=30)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"


# ──────────── Iter51 regression ─────────────
class TestIter51Regression:
    def test_sales_invite_email_reason_field(self, admin_session):
        email = f"TEST_iter52_reg_{secrets.token_hex(4)}@example.com"
        r = admin_session.post(
            f"{BASE_URL}/api/landing-chatbot/leads/sales-invite",
            json={"email": email, "message": "regression"},
            timeout=30,
        )
        assert r.status_code == 200
        d = r.json()
        for key in ("ok", "room_name", "join_url", "email_sent", "email_reason", "lead_email"):
            assert key in d, f"missing {key}"

    def test_csv_export_still_works(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/leads/export", timeout=30)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_analytics_base_endpoint(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/analytics", timeout=30)
        assert r.status_code == 200
